import { IT_DATABASE_URL } from '@test/support/integration-env';
import { Logger } from '@nestjs/common';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@app/infrastructure/prisma/client';
import { signPayload } from '@app/modules/shared/utils/signature.util';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { PaymentAuditLogRepository } from '@app/modules/audit/repositories/audit-log.repository';
import { AuditService } from '@netverse/nest-kit';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { randomBytes } from 'crypto';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { ProviderAccountRepository } from '@app/modules/provider-accounts/repositories/provider-account.repository';
import {
  ProviderAccountResolver,
  credentialAad,
} from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { PaymentWebhookEventRepository } from '@app/modules/provider-webhooks/repositories/payment-webhook-event.repository';
import { ProviderEventProcessorService } from '@app/modules/provider-webhooks/services/provider-event-processor.service';
import { ProviderEventRecorder } from '@app/modules/provider-webhooks/services/provider-event-recorder.service';
import { ProviderWebhookService } from '@app/modules/provider-webhooks/services/provider-webhook.service';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

const SECRET = 'whsec_it';
const cipher = new ProviderCredentialCipher(`1:${randomBytes(32).toString('base64')}`);
const PUBLIC_ID = 'pi_it_1';

describeIntegration('ProviderWebhookService — tích hợp Postgres', () => {
  let prisma: PrismaClient;
  let service: ProviderWebhookService;
  let outboxRepository: PaymentOutboxRepository;
  let intentId: string;
  let attemptId: string;

  beforeAll(async () => {
    const host = new URL(IT_DATABASE_URL!).host;
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      throw new Error(
        `Integration test chi chay tren DB local dung mot lan, khong chay tren ${host}`,
      );
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: IT_DATABASE_URL!, options: '-c timezone=UTC' }),
    });
    await prisma.$connect();
    const db = prisma as unknown as PrismaService;

    const intentRepository = new PaymentIntentRepository(db);
    const attemptRepository = new PaymentAttemptRepository(db);
    outboxRepository = new PaymentOutboxRepository(db);
    const processor = new ProviderEventProcessorService(
      intentRepository,
      attemptRepository,
      outboxRepository,
      new AuditService(new PaymentAuditLogRepository(db)),
    );
    service = new ProviderWebhookService(
      new PaymentProviderRegistry([new FakePaymentProvider()], []),
      intentRepository,
      attemptRepository,
      new ProviderAccountResolver(
        new ProviderAccountRepository(db),
        cipher as ProviderCredentialCryptoService,
      ),
      new ProviderEventRecorder(
        new PaymentWebhookEventRepository(db),
        processor,
        new TransactionRunner(db),
        { dispatchById: async () => ({ delivered: true }) } as unknown as OutboxService,
      ),
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
    const tenant = await prisma.tenants.create({ data: { code: 'it', name: 'Integration' } });
    const accountId = '00000000-0000-4000-8000-000000000001';
    const encrypted = cipher.encrypt({ webhook_secret: SECRET }, credentialAad(accountId));
    const account = await prisma.provider_accounts.create({
      data: {
        id: accountId,
        tenant_id: tenant.id,
        provider_code: 'fake',
        account_label: 'default',
        credentials_json: {},
        credentials_ciphertext: encrypted.ciphertext,
        credentials_iv: encrypted.iv,
        credentials_tag: encrypted.tag,
        credentials_key_version: encrypted.keyVersion,
      },
    });
    const intent = await prisma.payment_intents.create({
      data: {
        tenant_id: tenant.id,
        public_id: PUBLIC_ID,
        merchant_reference: 'merchant:subscription:it',
        target_type: 'user_subscription',
        target_ref: 'user-it',
        target_snapshot: {},
        title: 'Integration',
        currency: 'VND',
        subtotal_minor: 49000n,
        total_minor: 49000n,
      },
    });
    const attempt = await prisma.payment_attempts.create({
      data: {
        tenant_id: tenant.id,
        payment_intent_id: intent.id,
        provider_account_id: account.id,
        provider_code: 'fake',
        provider_payment_id: `fake_${PUBLIC_ID}`,
        provider_order_id: PUBLIC_ID,
        payment_method_type: 'manual',
        status: 'requires_action',
      },
    });
    intentId = intent.id;
    attemptId = attempt.id;
  });

  function send(body: Record<string, unknown>, signature?: string) {
    const rawBody = JSON.stringify(body);
    return service.ingest('fake', {
      method: 'POST',
      query: {},
      headers: { 'x-signature': signature ?? signPayload(SECRET, rawBody) },
      rawBody,
      body,
    });
  }

  function paidEvent(eventId: string, extra: Record<string, unknown> = {}) {
    return {
      eventId,
      eventType: 'payment.succeeded',
      providerPaymentId: `fake_${PUBLIC_ID}`,
      paymentIntentPublicId: PUBLIC_ID,
      status: 'succeeded',
      ...extra,
    };
  }

  async function snapshot() {
    const [intent, attempt, outbox, webhooks, audits] = await Promise.all([
      prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }),
      prisma.payment_attempts.findUniqueOrThrow({ where: { id: attemptId } }),
      prisma.payment_outbox_events.findMany(),
      prisma.payment_webhook_events.findMany({ orderBy: { created_at: 'asc' } }),
      prisma.auditLog.findMany(),
    ]);
    return { intent, attempt, outbox, webhooks, audits };
  }

  it('8 request CÙNG event-id đồng thời -> xử lý đúng 1 lần, còn lại duplicate, không 500', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => send(paidEvent('evt_dup'))));

    expect(results.filter((r) => r.duplicate === false)).toHaveLength(1);
    expect(results.filter((r) => r.duplicate === true)).toHaveLength(7);
    const state = await snapshot();
    expect(state.intent.status).toBe('succeeded');
    expect(state.outbox).toHaveLength(1);
    expect(state.webhooks).toHaveLength(1);
    expect(state.webhooks[0]!.status).toBe('processed');
  });

  it('6 event succeeded KHÁC event-id đồng thời -> khoá dòng intent => đúng 1 outbox event', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => send(paidEvent(`evt_par_${i}`))),
    );

    const state = await snapshot();
    expect(state.intent.status).toBe('succeeded');
    expect(state.outbox).toHaveLength(1);
    expect(state.webhooks.filter((w) => w.status === 'processed')).toHaveLength(1);
    expect(state.webhooks.filter((w) => w.status === 'ignored')).toHaveLength(5);
    expect(results.filter((r) => 'ignored' in r && r.ignored)).toHaveLength(5);
  });

  it('event failed đến muộn sau succeeded -> ignored, intent vẫn succeeded', async () => {
    await send(paidEvent('evt_ok'));
    const late = await send(
      paidEvent('evt_late_fail', { status: 'failed', eventType: 'payment.failed' }),
    );

    expect(late).toMatchObject({ ignored: true, reason: 'STALE_ATTEMPT_TRANSITION' });
    const state = await snapshot();
    expect(state.intent.status).toBe('succeeded');
    expect(state.attempt.status).toBe('succeeded');
    expect(state.outbox).toHaveLength(1);
  });

  it('outbox insert lỗi -> rollback cả transaction, event `failed`; provider retry -> claim lại và xử lý', async () => {
    jest.spyOn(outboxRepository, 'create').mockRejectedValueOnce(new Error('outbox insert failed'));

    await expect(send(paidEvent('evt_rollback'))).rejects.toThrow('outbox insert failed');
    let state = await snapshot();
    expect(state.intent.status).toBe('pending');
    expect(state.intent.paid_at).toBeNull();
    expect(state.attempt.status).toBe('requires_action');
    expect(state.outbox).toHaveLength(0);
    expect(state.webhooks).toHaveLength(1);
    expect(state.webhooks[0]).toMatchObject({
      status: 'failed',
      error_message: 'outbox insert failed',
    });
    const failedRowId = state.webhooks[0]!.id;

    const retry = await send(paidEvent('evt_rollback'));

    expect(retry).toMatchObject({
      duplicate: false,
      status: 'succeeded',
      webhookEventId: failedRowId,
    });
    state = await snapshot();
    expect(state.intent.status).toBe('succeeded');
    expect(state.outbox).toHaveLength(1);
    expect(state.webhooks).toHaveLength(1);
    expect(state.webhooks[0]).toMatchObject({
      id: failedRowId,
      status: 'processed',
      error_message: null,
    });
  });

  it('số tiền lệch -> KHÔNG succeeded, event ignored + audit', async () => {
    const result = await send(paidEvent('evt_amount', { amountMinor: '1000', currency: 'VND' }));

    expect(result).toMatchObject({ ignored: true, reason: 'AMOUNT_MISMATCH' });
    const state = await snapshot();
    expect(state.intent.status).toBe('pending');
    expect(state.outbox).toHaveLength(0);
    expect(state.webhooks[0]).toMatchObject({
      status: 'ignored',
      error_message: 'AMOUNT_MISMATCH',
    });
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: 'payment.provider_event.rejected',
      resourceId: intentId,
    });
  });

  it('số tiền khớp -> succeeded', async () => {
    await expect(
      send(paidEvent('evt_amount_ok', { amountMinor: '49000', currency: 'VND' })),
    ).resolves.toMatchObject({
      status: 'succeeded',
    });
  });

  it('chữ ký sai -> 401, KHÔNG ghi webhook event', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      send(paidEvent('evt_forged'), signPayload('whsec_wrong', 'x')),
    ).rejects.toMatchObject({ status: 401 });
    const state = await snapshot();
    expect(state.webhooks).toHaveLength(0);
    expect(state.intent.status).toBe('pending');
  });
});
