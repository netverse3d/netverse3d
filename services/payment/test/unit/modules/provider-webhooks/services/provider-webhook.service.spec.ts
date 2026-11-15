import { Logger } from '@nestjs/common';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { AppException } from '@netverse/nest-kit';
import { RawHttpResponse } from '@netverse/nest-kit';
import { signPayload } from '@app/common/utils/signature.util';
import { PrismaDb, TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import {
  PaymentProvider,
  ProviderWebhookRequest,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { PaymentWebhookEventRepository } from '@app/modules/provider-webhooks/repositories/payment-webhook-event.repository';
import { ProviderEventProcessorService } from '@app/modules/provider-webhooks/services/provider-event-processor.service';
import { ProviderEventRecorder } from '@app/modules/provider-webhooks/services/provider-event-recorder.service';
import { ProviderWebhookService } from '@app/modules/provider-webhooks/services/provider-webhook.service';

const SECRET = 'whsec_provider_test';
const TENANT_ID = 'tenant-1';
const INTENT_ID = 'intent-1';
const TX = { tx: true } as unknown as PrismaDb;

const payload = { eventId: 'evt_1', eventType: 'fake.ping', paymentIntentPublicId: 'pi_pub_1' };
const rawBody = JSON.stringify(payload);

function req(
  body: unknown,
  raw: string,
  headers: ProviderWebhookRequest['headers'] = {},
  method = 'POST',
): ProviderWebhookRequest {
  return { method, query: {}, headers, rawBody: raw, body };
}

function buildService(
  credentialsJson: Record<string, unknown> | null,
  registry?: PaymentProviderRegistry,
) {
  const webhookRepo = {
    claim: jest.fn().mockResolvedValue({ row: { id: 'wh-1' }, claimed: true }),
    markOutcome: jest.fn().mockResolvedValue({}),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
  const intentRepo = {
    findById: jest.fn().mockResolvedValue(null),
    findAnyByPublicId: jest.fn().mockResolvedValue({ id: INTENT_ID, tenant_id: TENANT_ID }),
  };
  const attemptRepo = {
    findByProviderPaymentId: jest.fn().mockResolvedValue(null),
    findByProviderOrderId: jest.fn().mockResolvedValue(null),
  };
  const processor = {
    apply: jest.fn().mockResolvedValue({
      kind: 'applied',
      intent: { id: INTENT_ID, public_id: 'pi_pub_1', status: 'succeeded' },
      intentChanged: true,
      attemptChanged: false,
      outboxEventId: 9n,
    }),
  };
  const events: string[] = [];
  const transactions = {
    run: jest.fn(async (fn: (tx: PrismaDb) => Promise<unknown>) => {
      events.push('tx:begin');
      const value = await fn(TX);
      events.push('tx:commit');
      return value;
    }),
  };
  const outboxService = {
    dispatchById: jest.fn(async () => {
      events.push('dispatch');
      return { delivered: true };
    }),
  };
  const account = credentialsJson
    ? {
        id: 'pa-1',
        tenant_id: TENANT_ID,
        externalAccountRef: null,
        credentials: credentialsJson,
        config: null,
      }
    : null;
  const providerAccountRepo = {
    byId: jest.fn().mockResolvedValue(account),
    activeByTenant: jest.fn().mockResolvedValue(account),
    byExternalRef: jest.fn().mockResolvedValue(null),
  };

  const recorder = new ProviderEventRecorder(
    webhookRepo as unknown as PaymentWebhookEventRepository,
    processor as unknown as ProviderEventProcessorService,
    transactions as unknown as TransactionRunner,
    outboxService as unknown as OutboxService,
  );
  const service = new ProviderWebhookService(
    registry ??
      new PaymentProviderRegistry(
        [
          new FakePaymentProvider(),
          new FakePaymentProvider({
            code: 'strict',
            capabilities: { requiresWebhookSecret: true },
          }),
        ],
        [],
      ),
    intentRepo as unknown as PaymentIntentRepository,
    attemptRepo as unknown as PaymentAttemptRepository,
    providerAccountRepo as unknown as ProviderAccountResolver,
    recorder,
  );

  return {
    service,
    webhookRepo,
    providerAccountRepo,
    processor,
    outboxService,
    transactions,
    intentRepo,
    attemptRepo,
    events,
  };
}

describe('ProviderWebhookService.ingest — verify chữ ký webhook inbound', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('account có secret + chữ ký đúng -> ingest pass, lưu signature + tenant/intent vào event', async () => {
    const { service, webhookRepo } = buildService({ webhook_secret: SECRET });
    const signature = signPayload(SECRET, rawBody);

    const result = await service.ingest(
      'fake',
      req(payload, rawBody, { 'x-signature': signature }),
    );

    expect(result).toEqual({ duplicate: false, webhookEventId: 'wh-1', skipped: true });
    expect(webhookRepo.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        signature,
        tenant_id: TENANT_ID,
        payment_intent_id: INTENT_ID,
        provider_event_id: 'evt_1',
      }),
      TX,
    );
    expect(webhookRepo.markOutcome).toHaveBeenCalledWith('wh-1', 'ignored', 'NO_STATUS', TX);
  });

  it('account có secret + chữ ký sai -> 401, KHÔNG ghi event (fail-closed)', async () => {
    const { service, webhookRepo } = buildService({ webhook_secret: SECRET });
    const forged = signPayload('whsec_wrong', rawBody);

    await expect(
      service.ingest('fake', req(payload, rawBody, { 'x-signature': forged })),
    ).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      service.ingest('fake', req(payload, rawBody, { 'x-signature': forged })),
    ).rejects.toBeInstanceOf(AppException);
    expect(webhookRepo.claim).not.toHaveBeenCalled();
    expect(webhookRepo.recordFailure).not.toHaveBeenCalled();
  });

  it('account có secret + THIẾU header x-signature -> 401, KHÔNG ghi event', async () => {
    const { service, webhookRepo } = buildService({ webhook_secret: SECRET });

    await expect(service.ingest('fake', req(payload, rawBody))).rejects.toMatchObject({
      status: 401,
    });
    expect(webhookRepo.claim).not.toHaveBeenCalled();
    expect(webhookRepo.recordFailure).not.toHaveBeenCalled();
  });

  it('provider requiresWebhookSecret + account KHÔNG có secret -> 401 NO_SECRET, không ghi event (fail-closed)', async () => {
    const { service, webhookRepo } = buildService({});

    await expect(service.ingest('strict', req(payload, rawBody))).rejects.toMatchObject({
      status: 401,
      details: { reason: 'NO_SECRET' },
    });
    expect(webhookRepo.claim).not.toHaveBeenCalled();
  });

  it('provider requiresWebhookSecret + KHÔNG resolve được account -> 401', async () => {
    const { service, webhookRepo } = buildService(null);

    await expect(service.ingest('strict', req(payload, rawBody))).rejects.toMatchObject({
      status: 401,
    });
    expect(webhookRepo.claim).not.toHaveBeenCalled();
  });

  it('provider test (không requiresWebhookSecret) + account KHÔNG có secret -> cho qua nhưng log cảnh báo, signature null', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, webhookRepo } = buildService({});

    const result = await service.ingest('fake', req(payload, rawBody));

    expect(result).toEqual({ duplicate: false, webhookEventId: 'wh-1', skipped: true });
    expect(webhookRepo.claim).toHaveBeenCalledWith(
      expect.objectContaining({ signature: null }),
      TX,
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('WITHOUT signature verification'));
  });

  it('header nhạy cảm KHÔNG được lưu vào headers_json', async () => {
    const { service, webhookRepo } = buildService({ webhook_secret: SECRET });
    const headers = {
      'x-signature': signPayload(SECRET, rawBody),
      authorization: 'Bearer x',
      cookie: 'a=b',
      'user-agent': 'provider',
    };

    await service.ingest('fake', req(payload, rawBody, headers));

    const saved = webhookRepo.claim.mock.calls[0][0].headers_json;
    expect(saved).toEqual({ 'x-signature': headers['x-signature'], 'user-agent': 'provider' });
  });
});

describe('ProviderWebhookService.ingest — transaction + vòng đời event', () => {
  const paid = {
    eventId: 'evt_paid',
    providerPaymentId: 'fake_pi_pub_1',
    paymentIntentPublicId: 'pi_pub_1',
    status: 'succeeded',
  };
  const paidRaw = JSON.stringify(paid);
  const signed = { 'x-signature': signPayload(SECRET, paidRaw) };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('event hợp lệ -> processor chạy TRONG tx, event processed, dispatch outbox SAU commit', async () => {
    const { service, webhookRepo, processor, events } = buildService({ webhook_secret: SECRET });

    const result = await service.ingest('fake', req(paid, paidRaw, signed));

    expect(processor.apply).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({
        intentId: INTENT_ID,
        providerCode: 'fake',
        source: 'webhook',
        sourceRef: 'wh-1',
        requireAmount: false,
      }),
    );
    expect(webhookRepo.markOutcome).toHaveBeenCalledWith('wh-1', 'processed', null, TX);
    expect(events).toEqual(['tx:begin', 'tx:commit', 'dispatch']);
    expect(result).toEqual({
      duplicate: false,
      webhookEventId: 'wh-1',
      paymentIntentId: INTENT_ID,
      publicId: 'pi_pub_1',
      status: 'succeeded',
      outboxEventId: '9',
    });
  });

  it('event trùng (claim thất bại) -> duplicate, không xử lý lại', async () => {
    const { service, webhookRepo, processor, outboxService } = buildService({
      webhook_secret: SECRET,
    });
    webhookRepo.claim.mockResolvedValueOnce({
      row: { id: 'wh-old', status: 'processed', error_message: null },
      claimed: false,
    });

    await expect(service.ingest('fake', req(paid, paidRaw, signed))).resolves.toEqual({
      duplicate: true,
      webhookEventId: 'wh-old',
      previousStatus: 'processed',
      previousReason: null,
    });
    expect(processor.apply).not.toHaveBeenCalled();
    expect(webhookRepo.markOutcome).not.toHaveBeenCalled();
    expect(outboxService.dispatchById).not.toHaveBeenCalled();
  });

  it('processor bị từ chối (stale/mismatch) -> event ignored kèm lý do, không dispatch', async () => {
    const { service, webhookRepo, processor, outboxService } = buildService({
      webhook_secret: SECRET,
    });
    processor.apply.mockResolvedValueOnce({
      kind: 'ignored',
      reason: 'AMOUNT_MISMATCH',
      intent: { id: INTENT_ID, public_id: 'pi_pub_1', status: 'pending' },
    });

    const result = await service.ingest('fake', req(paid, paidRaw, signed));

    expect(webhookRepo.markOutcome).toHaveBeenCalledWith('wh-1', 'ignored', 'AMOUNT_MISMATCH', TX);
    expect(outboxService.dispatchById).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ignored: true, reason: 'AMOUNT_MISMATCH', status: 'pending' });
  });

  it('lỗi giữa chừng (vd outbox insert) -> tx rollback, event ghi lại `failed`, lỗi ném ra', async () => {
    const { service, webhookRepo, processor, outboxService } = buildService({
      webhook_secret: SECRET,
    });
    processor.apply.mockRejectedValueOnce(new Error('outbox insert failed'));

    await expect(service.ingest('fake', req(paid, paidRaw, signed))).rejects.toThrow(
      'outbox insert failed',
    );
    expect(webhookRepo.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider_code: 'fake', provider_event_id: 'evt_paid' }),
      'outbox insert failed',
    );
    expect(webhookRepo.markOutcome).not.toHaveBeenCalled();
    expect(outboxService.dispatchById).not.toHaveBeenCalled();
  });

  it('có status nhưng không resolve được target -> ignored TARGET_NOT_FOUND (không 404, không failed)', async () => {
    const { service, webhookRepo, intentRepo, processor } = buildService(null);
    intentRepo.findAnyByPublicId.mockResolvedValue(null);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(service.ingest('fake', req(paid, paidRaw))).resolves.toMatchObject({
      ignored: true,
      reason: 'TARGET_NOT_FOUND',
    });
    expect(webhookRepo.markOutcome).toHaveBeenCalledWith('wh-1', 'ignored', 'TARGET_NOT_FOUND', TX);
    expect(webhookRepo.recordFailure).not.toHaveBeenCalled();
    expect(processor.apply).not.toHaveBeenCalled();
  });

  it('giao tenant KHÔNG chặn phản hồi webhook (dispatch treo vẫn trả kết quả)', async () => {
    const { service, outboxService } = buildService({ webhook_secret: SECRET });
    outboxService.dispatchById.mockImplementationOnce(() => new Promise(() => undefined));

    await expect(service.ingest('fake', req(paid, paidRaw, signed))).resolves.toMatchObject({
      outboxEventId: '9',
    });
    expect(outboxService.dispatchById).toHaveBeenCalled();
  });

  it('dispatch outbox lỗi -> vẫn trả kết quả (outbox đã commit, retry sau)', async () => {
    const { service, outboxService } = buildService({ webhook_secret: SECRET });
    outboxService.dispatchById.mockRejectedValueOnce(new Error('tenant down'));

    await expect(service.ingest('fake', req(paid, paidRaw, signed))).resolves.toMatchObject({
      outboxEventId: '9',
    });
  });

  it('status ngoài enum -> 400 trước khi chạm DB', async () => {
    const { service, webhookRepo, transactions } = buildService({ webhook_secret: SECRET });
    const bad = { ...paid, status: 'refunded' };
    const badRaw = JSON.stringify(bad);

    await expect(
      service.ingest('fake', req(bad, badRaw, { 'x-signature': signPayload(SECRET, badRaw) })),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(transactions.run).not.toHaveBeenCalled();
    expect(webhookRepo.recordFailure).not.toHaveBeenCalled();
  });
});

describe('ProviderWebhookService — contract v2 (transport, chéo tenant, ACK)', () => {
  const paid = {
    eventId: 'evt_v2',
    providerPaymentId: 'fake_pi_pub_1',
    paymentIntentPublicId: 'pi_pub_1',
    status: 'succeeded',
  };
  const paidRaw = JSON.stringify(paid);
  const signed = { 'x-signature': signPayload(SECRET, paidRaw) };

  it('fake chỉ nhận POST: GET -> 405, không chạm DB', async () => {
    const { service, transactions, attemptRepo } = buildService({ webhook_secret: SECRET });

    await expect(service.ingest('fake', req(undefined, '', {}, 'GET'))).rejects.toMatchObject({
      status: 405,
    });
    expect(transactions.run).not.toHaveBeenCalled();
    expect(attemptRepo.findByProviderPaymentId).not.toHaveBeenCalled();
  });

  it('attempt thuộc account KHÁC account đã ký -> 401, không ghi event', async () => {
    const { service, webhookRepo, attemptRepo, intentRepo, providerAccountRepo } = buildService({
      webhook_secret: SECRET,
    });
    attemptRepo.findByProviderPaymentId.mockResolvedValue({
      id: 'attempt-1',
      tenant_id: TENANT_ID,
      provider_account_id: 'pa-victim',
      payment_intents: { id: INTENT_ID },
    });
    intentRepo.findById.mockResolvedValue({ id: INTENT_ID, tenant_id: TENANT_ID });
    providerAccountRepo.byId.mockResolvedValue({
      id: 'pa-attacker',
      tenant_id: 'tenant-attacker',
      externalAccountRef: null,
      credentials: { webhook_secret: SECRET },
      config: null,
    });

    await expect(service.ingest('fake', req(paid, paidRaw, signed))).rejects.toMatchObject({
      status: 401,
    });
    expect(webhookRepo.claim).not.toHaveBeenCalled();
  });

  it('tìm attempt theo merchant reference khi event chưa có providerPaymentId (kiểu VNPAY vnp_TxnRef)', async () => {
    const { service, attemptRepo, intentRepo, processor } = buildService({
      webhook_secret: SECRET,
    });
    attemptRepo.findByProviderOrderId.mockResolvedValue({
      id: 'attempt-9',
      tenant_id: TENANT_ID,
      provider_account_id: 'pa-1',
      payment_intents: { id: INTENT_ID },
    });
    intentRepo.findById.mockResolvedValue({ id: INTENT_ID, tenant_id: TENANT_ID });
    const body = { eventId: 'evt_ref', providerOrderId: 'ref-abc', status: 'succeeded' };
    const raw = JSON.stringify(body);

    await service.ingest('fake', req(body, raw, { 'x-signature': signPayload(SECRET, raw) }));

    expect(attemptRepo.findByProviderOrderId).toHaveBeenCalledWith('fake', 'ref-abc');
    expect(processor.apply).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ attemptId: 'attempt-9', intentId: INTENT_ID }),
    );
  });

  it('providerPaymentId không khớp attempt nào -> rơi về providerOrderId (C1, kiểu vnp_TransactionNo)', async () => {
    const { service, attemptRepo, intentRepo, processor } = buildService({
      webhook_secret: SECRET,
    });
    attemptRepo.findByProviderOrderId.mockResolvedValue({
      id: 'attempt-9',
      tenant_id: TENANT_ID,
      provider_account_id: 'pa-1',
      payment_intents: { id: INTENT_ID },
    });
    intentRepo.findById.mockResolvedValue({ id: INTENT_ID, tenant_id: TENANT_ID });
    const body = {
      eventId: 'evt_c1',
      providerPaymentId: '14000001',
      providerOrderId: 'ref-abc',
      status: 'succeeded',
    };
    const raw = JSON.stringify(body);

    await service.ingest('fake', req(body, raw, { 'x-signature': signPayload(SECRET, raw) }));

    expect(attemptRepo.findByProviderPaymentId).toHaveBeenCalledWith('fake', '14000001');
    expect(attemptRepo.findByProviderOrderId).toHaveBeenCalledWith('fake', 'ref-abc');
    expect(processor.apply).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ attemptId: 'attempt-9' }),
    );
  });

  it('routeAccountRef chưa đăng ký -> 401 UNKNOWN_ACCOUNT, không ghi event', async () => {
    const { service, webhookRepo, providerAccountRepo } = buildService({ webhook_secret: SECRET });
    providerAccountRepo.byExternalRef.mockResolvedValue(null);

    await expect(
      service.ingest('fake', { ...req(paid, paidRaw, signed), routeAccountRef: 'acct-x' }),
    ).rejects.toMatchObject({
      status: 401,
      details: { reason: 'UNKNOWN_ACCOUNT' },
    });
    expect(providerAccountRepo.byExternalRef).toHaveBeenCalledWith('fake', 'acct-x');
    expect(webhookRepo.claim).not.toHaveBeenCalled();
  });

  it('routeAccountRef đã đăng ký -> dùng account đó để verify, không tra theo attempt', async () => {
    const { service, providerAccountRepo } = buildService({ webhook_secret: SECRET });
    providerAccountRepo.byExternalRef.mockResolvedValue({
      id: 'pa-1',
      tenant_id: TENANT_ID,
      externalAccountRef: 'acct-1',
      credentials: { webhook_secret: SECRET },
      config: null,
    });

    await expect(
      service.ingest('fake', { ...req(paid, paidRaw, signed), routeAccountRef: 'acct-1' }),
    ).resolves.toMatchObject({ status: 'succeeded' });
    expect(providerAccountRepo.activeByTenant).not.toHaveBeenCalled();
  });

  describe('handle() với provider tự trả ACK', () => {
    function ackProvider(): PaymentProvider {
      return new FakePaymentProvider({
        acknowledgeWebhook: jest.fn((outcome) => ({ httpStatus: 200, body: { ack: outcome } })),
      });
    }

    function registryOf(provider: PaymentProvider) {
      return new PaymentProviderRegistry([provider], []);
    }

    it('thành công -> RawHttpResponse với outcome processed', async () => {
      const provider = ackProvider();
      const { service } = buildService({ webhook_secret: SECRET }, registryOf(provider));

      const response = await service.handle('fake', req(paid, paidRaw, signed));

      expect(response).toBeInstanceOf(RawHttpResponse);
      expect(response).toMatchObject({
        status: 200,
        body: { ack: { kind: 'processed', status: 'succeeded' } },
      });
    });

    it('chữ ký sai -> KHÔNG ném lỗi mà trả ACK rejected 401 (provider cần dùng mã lỗi riêng)', async () => {
      const provider = ackProvider();
      const { service, webhookRepo } = buildService(
        { webhook_secret: SECRET },
        registryOf(provider),
      );

      const response = await service.handle(
        'fake',
        req(paid, paidRaw, { 'x-signature': 'deadbeef' }),
      );

      expect(response).toMatchObject({ body: { ack: { kind: 'rejected', statusCode: 401 } } });
      expect(webhookRepo.claim).not.toHaveBeenCalled();
    });

    it('duplicate -> ACK duplicate', async () => {
      const provider = ackProvider();
      const { service, webhookRepo } = buildService(
        { webhook_secret: SECRET },
        registryOf(provider),
      );
      webhookRepo.claim.mockResolvedValueOnce({
        row: { id: 'wh-old', status: 'ignored', error_message: 'AMOUNT_MISMATCH' },
        claimed: false,
      });

      await expect(service.handle('fake', req(paid, paidRaw, signed))).resolves.toMatchObject({
        body: {
          ack: { kind: 'duplicate', previousStatus: 'ignored', previousReason: 'AMOUNT_MISMATCH' },
        },
      });
    });

    it('provider KHÔNG có ACK -> giữ kết quả và lỗi mặc định', async () => {
      const { service } = buildService({ webhook_secret: SECRET });

      await expect(service.handle('fake', req(paid, paidRaw, signed))).resolves.toMatchObject({
        status: 'succeeded',
      });
      await expect(
        service.handle('fake', req(paid, paidRaw, { 'x-signature': 'bad' })),
      ).rejects.toMatchObject({ status: 401 });
    });
  });
});
