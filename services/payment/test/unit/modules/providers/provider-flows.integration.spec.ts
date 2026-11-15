import { IT_DATABASE_URL } from '@test/support/integration-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@app/infrastructure/prisma/client';
import { createHmac, randomBytes } from 'crypto';
import { RawHttpResponse } from '@netverse/nest-kit';
import { CurrentTenantPayload } from '@app/modules/auth/decorators/current-tenant.decorator';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { PaymentAuditLogRepository } from '@app/modules/audit/repositories/audit-log.repository';
import { AuditService } from '@netverse/nest-kit';
import { IdempotencyRepository } from '@app/modules/idempotency/repositories/idempotency.repository';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { PaymentAttemptService } from '@app/modules/payments/services/payment-attempt.service';
import { ProviderAccountRepository } from '@app/modules/provider-accounts/repositories/provider-account.repository';
import {
  ProviderAccountResolver,
  credentialAad,
} from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { PaymentWebhookEventRepository } from '@app/modules/provider-webhooks/repositories/payment-webhook-event.repository';
import { ProviderEventProcessorService } from '@app/modules/provider-webhooks/services/provider-event-processor.service';
import { ProviderEventRecorder } from '@app/modules/provider-webhooks/services/provider-event-recorder.service';
import { ProviderWebhookService } from '@app/modules/provider-webhooks/services/provider-webhook.service';
import { OperatorConfirmService } from '@app/modules/provider-webhooks/services/operator-confirm.service';
import { PaymentIntentService } from '@app/modules/payments/services/payment-intent.service';
import { PaymentQueryService } from '@app/modules/payments/services/payment-query.service';
import { CustomerService } from '@app/modules/customers/services/customer.service';
import { BankTransferQrProvider } from '@app/modules/providers/vietqr/vietqr.provider';
import {
  PaymentProvider,
  ProviderRuntimeConfig,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { payosDataString, payosSign } from '@app/modules/providers/payos/payos-signature.util';
import { PayosProvider } from '@app/modules/providers/payos/payos.provider';
import { signVnpayParams } from '@app/modules/providers/vnpay/vnpay-signature.util';
import { VnpayProvider } from '@app/modules/providers/vnpay/vnpay.provider';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

const cipher = new ProviderCredentialCipher(`1:${randomBytes(32).toString('base64')}`);
const VNP_SECRET = 'A'.repeat(32);
const CONFIG: ProviderRuntimeConfig = {
  httpTimeoutMs: 1000,
  expiryGraceMinutes: 10,
  serverIp: '198.51.100.10',
  vnpayPaymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  vnpayApiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  payosApiBaseUrl: 'http://127.0.0.1:9',
  payosOrderCodeOffset: 0,
};

export interface FlowHarness {
  prisma: PrismaClient;
  tenant: CurrentTenantPayload;
  attempts: PaymentAttemptService;
  webhooks: ProviderWebhookService;
  operator: OperatorConfirmService;
  createIntent(publicId: string, totalMinor?: bigint): Promise<{ id: string; public_id: string }>;
  createAccount(
    providerCode: string,
    externalRef: string,
    credentials: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<string>;
  snapshot(intentId: string): Promise<{
    intent: { status: string };
    attempts: Array<{
      status: string;
      failure_code: string | null;
      provider_payment_id: string | null;
    }>;
    outbox: Array<{ event_type: string; payload_json: unknown }>;
    events: Array<{ status: string; error_message: string | null; provider_event_id: string }>;
  }>;
}

export async function buildFlowHarness(providers: PaymentProvider[]): Promise<FlowHarness> {
  const host = new URL(IT_DATABASE_URL!).host;
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    throw new Error(
      `Integration test chi chay tren DB local dung mot lan, khong chay tren ${host}`,
    );
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: IT_DATABASE_URL!, options: '-c timezone=UTC' }),
  });
  await prisma.$connect();
  const db = prisma as unknown as PrismaService;
  const registry = new PaymentProviderRegistry(
    providers,
    providers.map((provider) => provider.code),
  );
  const intentRepository = new PaymentIntentRepository(db);
  const attemptRepository = new PaymentAttemptRepository(db);
  const resolver = new ProviderAccountResolver(
    new ProviderAccountRepository(db),
    cipher as ProviderCredentialCryptoService,
  );
  const recorder = new ProviderEventRecorder(
    new PaymentWebhookEventRepository(db),
    new ProviderEventProcessorService(
      intentRepository,
      attemptRepository,
      new PaymentOutboxRepository(db),
      new AuditService(new PaymentAuditLogRepository(db)),
    ),
    new TransactionRunner(db),
    { dispatchById: async () => ({}) } as unknown as OutboxService,
  );
  const harness: FlowHarness = {
    prisma,
    tenant: { tenantId: '', tenantCode: 'it-flow' },
    attempts: new PaymentAttemptService(
      intentRepository,
      attemptRepository,
      resolver,
      registry,
      new IdempotencyService(new IdempotencyRepository(db)),
    ),
    webhooks: new ProviderWebhookService(
      registry,
      intentRepository,
      attemptRepository,
      resolver,
      recorder,
    ),
    operator: new OperatorConfirmService(
      attemptRepository,
      registry,
      recorder,
      new AuditService(new PaymentAuditLogRepository(db)),
      new PaymentQueryService(
        new PaymentIntentService(intentRepository, {} as CustomerService, {} as IdempotencyService),
      ),
    ),
    async createIntent(publicId, totalMinor = 49000n) {
      return prisma.payment_intents.create({
        data: {
          tenant_id: harness.tenant.tenantId,
          public_id: publicId,
          target_type: 'user_subscription',
          target_ref: 'user-flow',
          target_snapshot: {},
          title: 'Flow',
          currency: 'VND',
          subtotal_minor: totalMinor,
          total_minor: totalMinor,
        },
      });
    },
    async createAccount(providerCode, externalRef, credentials, config) {
      const id = `00000000-0000-4000-8000-${randomBytes(6).toString('hex')}`;
      const encrypted = cipher.encrypt(credentials, credentialAad(id));
      await prisma.provider_accounts.create({
        data: {
          id,
          tenant_id: harness.tenant.tenantId,
          provider_code: providerCode,
          account_label: `${providerCode}-it`,
          external_account_ref: externalRef,
          credentials_json: {},
          config_json: (config ?? undefined) as Prisma.InputJsonValue | undefined,
          credentials_ciphertext: encrypted.ciphertext,
          credentials_iv: encrypted.iv,
          credentials_tag: encrypted.tag,
          credentials_key_version: encrypted.keyVersion,
        },
      });
      return id;
    },
    async snapshot(intentId) {
      return {
        intent: await prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }),
        attempts: await prisma.payment_attempts.findMany({
          where: { payment_intent_id: intentId },
          orderBy: { created_at: 'asc' },
        }),
        outbox: await prisma.payment_outbox_events.findMany({
          where: { payment_intent_id: intentId },
          orderBy: { id: 'asc' },
        }),
        events: await prisma.payment_webhook_events.findMany({ orderBy: { created_at: 'asc' } }),
      };
    },
  };
  return harness;
}

export async function resetTenant(harness: FlowHarness) {
  await harness.prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
  const tenant = await harness.prisma.tenants.create({ data: { code: 'it-flow', name: 'Flow' } });
  harness.tenant = { tenantId: tenant.id, tenantCode: tenant.code };
}

function ack(response: unknown) {
  expect(response).toBeInstanceOf(RawHttpResponse);
  return response as RawHttpResponse;
}

describeIntegration('VNPAY — tạo attempt thật + IPN qua Postgres', () => {
  let h: FlowHarness;

  beforeAll(async () => {
    h = await buildFlowHarness([new VnpayProvider(CONFIG)]);
  });

  afterAll(async () => {
    await h?.prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTenant(h);
    await h.createAccount('vnpay', 'ITTMN001', { hashSecret: VNP_SECRET });
  });

  async function startCheckout(publicId: string, key = `k-${publicId}`) {
    const intent = await h.createIntent(publicId);
    const attempt = (await h.attempts.create(h.tenant, publicId, key, {
      providerCode: 'vnpay',
      returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_it',
      clientIp: '203.0.113.7',
    })) as {
      id: string;
      provider_order_id: string;
      order_number: number;
      next_action: { type: string; url: string };
      checkout_url: string;
    };
    return { intent, attempt };
  }

  function ipn(fields: Record<string, string>, secret = VNP_SECRET) {
    const { query, secureHash } = signVnpayParams(fields, secret);
    return h.webhooks.handle('vnpay', {
      method: 'GET',
      query: {},
      rawQuery: `${query}&vnp_SecureHash=${secureHash}`,
      headers: {},
      rawBody: '',
      body: undefined,
    });
  }

  function paid(txnRef: string, extra: Record<string, string> = {}) {
    return {
      vnp_Amount: '4900000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'Payment 1',
      vnp_PayDate: '20261019003500',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'ITTMN001',
      vnp_TransactionNo: '14000001',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: txnRef,
      ...extra,
    };
  }

  it('attempt: URL dài > 500 ký tự lưu được (checkout_url Text), next_action redirect, order_number cấp từ sequence', async () => {
    const { attempt } = await startCheckout('pi_vnp_url');

    expect(attempt.checkout_url.length).toBeGreaterThan(500);
    expect(attempt.next_action).toEqual({ type: 'redirect', url: attempt.checkout_url });
    expect(attempt.order_number).toBeGreaterThan(0);
    const replay = await h.attempts.create(h.tenant, 'pi_vnp_url', 'k-pi_vnp_url', {
      providerCode: 'vnpay',
      returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_it',
      clientIp: '198.51.100.1',
    });
    expect(replay).toMatchObject({ id: attempt.id, next_action: { type: 'redirect' } });
  });

  it('IPN 00/00 -> RspCode 00, succeeded + outbox; gửi lại -> 02; IPN có vnp_TransactionNo vẫn khớp attempt (C1)', async () => {
    const { intent, attempt } = await startCheckout('pi_vnp_ok');

    expect(ack(await ipn(paid(attempt.provider_order_id))).body).toEqual({
      RspCode: '00',
      Message: 'Confirm Success',
    });
    let s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('succeeded');
    expect(s.attempts[0]).toMatchObject({ status: 'succeeded', provider_payment_id: '14000001' });
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.succeeded']);
    expect(s.outbox[0]!.payload_json).toMatchObject({
      attemptId: attempt.id,
      orderNumber: String(attempt.order_number),
      providerCode: 'vnpay',
    });

    expect(ack(await ipn(paid(attempt.provider_order_id))).body).toMatchObject({ RspCode: '02' });
    s = await h.snapshot(intent.id);
    expect(s.outbox).toHaveLength(1);
  });

  it('chữ ký sai -> 97, KHÔNG ghi event', async () => {
    const { intent, attempt } = await startCheckout('pi_vnp_sig');

    expect(
      ack(await ipn(paid(attempt.provider_order_id), 'WRONGSECRET0000000')).body,
    ).toMatchObject({ RspCode: '97' });
    const s = await h.snapshot(intent.id);
    expect(s.events).toHaveLength(0);
    expect(s.intent.status).toBe('pending');
  });

  it('không thấy đơn -> 01, event ignored TARGET_NOT_FOUND', async () => {
    await startCheckout('pi_vnp_nf');

    expect(ack(await ipn(paid('ffffffffffffffffffffffffffffffff'))).body).toMatchObject({
      RspCode: '01',
    });
    const events = await h.prisma.payment_webhook_events.findMany();
    expect(events[0]).toMatchObject({ status: 'ignored', error_message: 'TARGET_NOT_FOUND' });
    expect(ack(await ipn(paid('ffffffffffffffffffffffffffffffff'))).body).toMatchObject({
      RspCode: '01',
    });
  });

  it('sai số tiền -> 04, không thu', async () => {
    const { intent, attempt } = await startCheckout('pi_vnp_amt');

    expect(
      ack(await ipn(paid(attempt.provider_order_id, { vnp_Amount: '100000' }))).body,
    ).toMatchObject({ RspCode: '04' });
    expect((await h.snapshot(intent.id)).intent.status).toBe('pending');
  });

  it('24 -> canceled kèm failure_code; thành công đến sau (tiền về muộn) vẫn succeeded (D4)', async () => {
    const { intent, attempt } = await startCheckout('pi_vnp_cancel');

    expect(
      ack(
        await ipn(
          paid(attempt.provider_order_id, {
            vnp_ResponseCode: '24',
            vnp_TransactionStatus: '02',
            vnp_TransactionNo: '0',
          }),
        ),
      ).body,
    ).toMatchObject({ RspCode: '00' });
    let s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('canceled');
    expect(s.attempts[0]).toMatchObject({
      status: 'canceled',
      failure_code: '24',
      provider_payment_id: null,
    });
    expect(s.outbox[0]).toMatchObject({
      event_type: 'payment.canceled',
      payload_json: expect.objectContaining({ failureCode: '24' }),
    });

    expect(ack(await ipn(paid(attempt.provider_order_id))).body).toMatchObject({ RspCode: '00' });
    s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('succeeded');
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.canceled', 'payment.succeeded']);
  });
});

describeIntegration('payOS — tạo link (API giả lập) + webhook qua Postgres', () => {
  const CHECKSUM = 'payos-it-checksum';
  const CLIENT_ID = 'payos-client-it';
  let h: FlowHarness;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    h = await buildFlowHarness([new PayosProvider(CONFIG)]);
  });

  afterAll(async () => {
    await h?.prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTenant(h);
    await h.createAccount('payos', CLIENT_ID, {
      clientId: CLIENT_ID,
      apiKey: 'api-it',
      checksumKey: CHECKSUM,
    });
  });

  afterEach(() => fetchSpy?.mockRestore());

  function signedEnvelope(data: Record<string, unknown>) {
    return new Response(
      JSON.stringify({
        code: '00',
        desc: 'success',
        data,
        signature: payosSign(CHECKSUM, payosDataString(data)),
      }),
      { status: 200 },
    );
  }

  async function startCheckout(publicId: string) {
    const intent = await h.createIntent(publicId);
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const request = JSON.parse(String((init as RequestInit).body));
      return signedEnvelope({
        amount: request.amount,
        orderCode: request.orderCode,
        description: request.description,
        currency: 'VND',
        paymentLinkId: `plink_${request.orderCode}`,
        status: 'PENDING',
        checkoutUrl: `https://pay.payos.vn/web/plink_${request.orderCode}`,
        qrCode: '000201',
      });
    });
    const attempt = (await h.attempts.create(h.tenant, publicId, `k-${publicId}`, {
      providerCode: 'payos',
      returnUrl: 'https://shop.example.test/thanh-toan/ket-qua?checkout=cs_it',
    })) as {
      id: string;
      provider_order_id: string;
      provider_payment_id: string;
      next_action: { type: string; url: string };
    };
    fetchSpy.mockRestore();
    return { intent, attempt };
  }

  function send(
    data: Record<string, unknown>,
    options: { checksum?: string; accountRef?: string } = {},
  ) {
    const body = {
      code: '00',
      desc: 'success',
      success: true,
      data,
      signature: payosSign(options.checksum ?? CHECKSUM, payosDataString(data)),
    };
    return h.webhooks.handle('payos', {
      method: 'POST',
      query: {},
      headers: {},
      rawBody: JSON.stringify(body),
      body,
      routeAccountRef: options.accountRef ?? CLIENT_ID,
    });
  }

  function paidData(orderCode: string, extra: Record<string, unknown> = {}) {
    return {
      orderCode: Number(orderCode),
      amount: 49000,
      description: 'QZ',
      accountNumber: '113366668888',
      reference: `FT${orderCode}`,
      transactionDateTime: '2026-10-18 17:20:00',
      currency: 'VND',
      paymentLinkId: `plink_${orderCode}`,
      code: '00',
      desc: 'success',
      ...extra,
    };
  }

  it('attempt: providerOrderId = orderCode; phản hồi thiếu trường ngân hàng -> next_action redirect checkoutUrl', async () => {
    const { attempt } = await startCheckout('pi_payos_url');
    expect(attempt.next_action).toEqual({
      type: 'redirect',
      url: `https://pay.payos.vn/web/plink_${attempt.provider_order_id}`,
    });
    expect(attempt.provider_payment_id).toBe(`plink_${attempt.provider_order_id}`);
  });

  it('webhook ký đúng -> 200 {success:true} + succeeded; gửi lại -> 200, không outbox lần hai', async () => {
    const { intent, attempt } = await startCheckout('pi_payos_ok');

    expect(ack(await send(paidData(attempt.provider_order_id)))).toMatchObject({
      status: 200,
      body: { success: true },
    });
    expect(ack(await send(paidData(attempt.provider_order_id)))).toMatchObject({ status: 200 });
    const s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('succeeded');
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.succeeded']);
  });

  it('chữ ký sai -> 401, không ghi event', async () => {
    const { intent, attempt } = await startCheckout('pi_payos_sig');

    expect(
      ack(await send(paidData(attempt.provider_order_id), { checksum: 'wrong' })),
    ).toMatchObject({ status: 401 });
    expect((await h.snapshot(intent.id)).events).toHaveLength(0);
  });

  it('orderCode lạ (payOS confirm-webhook gửi thử) -> 200, event ignored TARGET_NOT_FOUND', async () => {
    await startCheckout('pi_payos_nf');

    expect(ack(await send(paidData('123')))).toMatchObject({
      status: 200,
      body: { success: true },
    });
    const events = await h.prisma.payment_webhook_events.findMany();
    expect(events[0]).toMatchObject({ status: 'ignored', error_message: 'TARGET_NOT_FOUND' });
  });

  it('clientId trên đường dẫn không đăng ký -> 401', async () => {
    const { attempt } = await startCheckout('pi_payos_acct');
    expect(
      ack(await send(paidData(attempt.provider_order_id), { accountRef: 'unknown-client' })),
    ).toMatchObject({ status: 401 });
  });

  it('thiếu tiền -> ignored AMOUNT_MISMATCH, intent không thu', async () => {
    const { intent, attempt } = await startCheckout('pi_payos_amt');

    expect(ack(await send(paidData(attempt.provider_order_id, { amount: 1000 })))).toMatchObject({
      status: 200,
    });
    expect((await h.snapshot(intent.id)).intent.status).toBe('pending');
  });
});

describeIntegration('VietQR — QR + SePay + xác nhận thủ công qua Postgres', () => {
  const ACCOUNT_NUMBER = '113366668888';
  const API_KEY = 'sepay-it-key';
  const HMAC_SECRET = 'sepay-it-hmac';
  let h: FlowHarness;

  beforeAll(async () => {
    h = await buildFlowHarness([new BankTransferQrProvider()]);
  });

  afterAll(async () => {
    await h?.prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetTenant(h);
    await h.createAccount(
      'vietqr',
      ACCOUNT_NUMBER,
      { sepayApiKey: API_KEY, sepayHmacSecret: HMAC_SECRET },
      {
        bankBin: '970415',
        bankName: 'VietinBank',
        accountNumber: ACCOUNT_NUMBER,
        accountName: 'CONG TY DEMO',
        referencePrefix: 'QZ',
        ttlMinutes: 30,
      },
    );
  });

  async function startCheckout(publicId: string) {
    const intent = await h.createIntent(publicId);
    const attempt = (await h.attempts.create(h.tenant, publicId, `k-${publicId}`, {
      providerCode: 'vietqr',
    })) as {
      id: string;
      provider_order_id: string;
      next_action: Record<string, unknown>;
    };
    return { intent, attempt };
  }

  function sepay(
    body: Record<string, unknown>,
    auth: 'apikey' | 'hmac' | 'wrong' = 'apikey',
    routed = true,
  ) {
    const rawBody = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', HMAC_SECRET)
      .update(ts + '.' + rawBody)
      .digest('hex');
    const headers =
      auth === 'apikey'
        ? { authorization: 'Apikey ' + API_KEY }
        : auth === 'hmac'
          ? { 'x-sepay-timestamp': ts, 'x-sepay-signature': 'sha256=' + signature }
          : { authorization: 'Apikey nope' };
    return h.webhooks.handle('vietqr', {
      method: 'POST',
      query: {},
      headers,
      rawBody,
      body,
      routeAccountRef: routed ? ACCOUNT_NUMBER : null,
    });
  }

  function transfer(
    id: number,
    content: string,
    amount = 49000,
    extra: Record<string, unknown> = {},
  ) {
    return {
      id,
      gateway: 'VietinBank',
      transactionDate: '2026-10-18 17:20:00',
      accountNumber: ACCOUNT_NUMBER,
      subAccount: null,
      code: null,
      content,
      transferType: 'in',
      transferAmount: amount,
      accumulated: 1000000,
      referenceCode: 'FT' + id,
      description: 'BankAPINotify ' + content,
      ...extra,
    };
  }

  it('attempt trả next_action qr đủ trường cho BE', async () => {
    const { attempt } = await startCheckout('pi_vqr_na');
    expect(attempt.next_action).toMatchObject({
      type: 'qr',
      bankBin: '970415',
      bankName: 'VietinBank',
      accountNumber: ACCOUNT_NUMBER,
      accountName: 'CONG TY DEMO',
      amountMinor: 49000,
      currency: 'VND',
      reference: attempt.provider_order_id,
    });
    expect(typeof attempt.next_action.expiresAt).toBe('string');
    expect(String(attempt.next_action.payload)).toContain(attempt.provider_order_id);
  });

  it('SePay Apikey + nội dung chèn thêm chữ -> succeeded; trùng id (kể cả qua HMAC) -> một lần', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_ok');
    const body = transfer(101, 'MBVCB.123.' + attempt.provider_order_id + '.CT tu NGUYEN VAN A');

    expect(ack(await sepay(body))).toMatchObject({ status: 200, body: { success: true } });
    expect(ack(await sepay(body, 'hmac'))).toMatchObject({ status: 200 });
    const s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('succeeded');
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.succeeded']);
    expect(
      s.events.filter((e) => e.provider_event_id === 'sepay:' + ACCOUNT_NUMBER + ':101'),
    ).toHaveLength(1);
  });

  it('Apikey sai -> 401, không ghi event', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_401');
    expect(ack(await sepay(transfer(102, attempt.provider_order_id), 'wrong'))).toMatchObject({
      status: 401,
    });
    expect((await h.snapshot(intent.id)).events).toHaveLength(0);
  });

  it('transferType out -> ignored NO_STATUS; thiếu tiền -> ignored AMOUNT_MISMATCH + audit', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_out');

    await sepay(transfer(103, attempt.provider_order_id, 49000, { transferType: 'out' }));
    await sepay(transfer(104, attempt.provider_order_id, 40000));
    const s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('pending');
    expect(s.events.map((e) => e.error_message)).toEqual(['NO_STATUS', 'AMOUNT_MISMATCH']);
    expect(
      await h.prisma.auditLog.count({ where: { action: 'payment.provider_event.rejected' } }),
    ).toBe(1);
  });

  it('chuyển khoản lần hai (mã ngân hàng khác) vào attempt đã thu -> extra_capture, intent giữ nguyên', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_twice');

    await sepay(transfer(105, attempt.provider_order_id));
    await sepay(transfer(106, attempt.provider_order_id));
    const s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('succeeded');
    expect(s.outbox.map((e) => e.event_type)).toEqual([
      'payment.succeeded',
      'payment.extra_capture',
    ]);
  });

  it('xác nhận thủ công: succeeded một lần; gọi lại -> 409 TRANSFER_NOT_CONFIRMABLE; lệch tiền -> 422', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_op');
    const confirm = (amountMinor: number) =>
      h.operator.confirmTransfer(h.tenant.tenantId, attempt.id, {
        amountMinor,
        currency: 'VND',
        bankReference: 'FT9',
        operatorRef: 'admin:1',
      });

    await expect(confirm(1000)).rejects.toMatchObject({ status: 422 });
    await expect(confirm(49000)).resolves.toMatchObject({ status: 'succeeded' });
    await expect(confirm(49000)).rejects.toMatchObject({
      status: 409,
      details: { reason: 'TRANSFER_NOT_CONFIRMABLE' },
    });
    const s = await h.snapshot(intent.id);
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.succeeded']);
    expect(
      await h.prisma.auditLog.count({
        where: { action: 'payment.operator.transfer_confirmed', actorSubject: 'admin:1' },
      }),
    ).toBe(1);
  });

  it('xác nhận thủ công rồi SePay báo cùng giao dịch ngân hàng -> không extra_capture', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_op_then_sepay');
    await h.operator.confirmTransfer(h.tenant.tenantId, attempt.id, {
      amountMinor: 49000,
      currency: 'VND',
      bankReference: 'ft 110',
      operatorRef: 'admin:1',
    });
    await sepay(transfer(110, attempt.provider_order_id));
    const s = await h.snapshot(intent.id);
    expect(s.attempts[0]!.provider_payment_id).toBe('bank:FT110');
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.succeeded']);
  });

  it('một mã giao dịch ngân hàng không xác nhận được cho hai giao dịch -> 409 BANK_REFERENCE_USED', async () => {
    const first = await startCheckout('pi_vqr_ref_a');
    const second = await startCheckout('pi_vqr_ref_b');
    const confirm = (attemptId: string) =>
      h.operator.confirmTransfer(h.tenant.tenantId, attemptId, {
        amountMinor: 49000,
        currency: 'VND',
        bankReference: 'FT777',
        operatorRef: 'admin:1',
      });

    await expect(confirm(first.attempt.id)).resolves.toMatchObject({ status: 'succeeded' });
    await expect(confirm(second.attempt.id)).rejects.toMatchObject({
      status: 409,
      details: { reason: 'BANK_REFERENCE_USED' },
    });
    expect((await h.snapshot(second.intent.id)).intent.status).toBe('pending');
  });

  it('SePay không kèm số TK trên đường dẫn + tenant đổi tiền tố -> vẫn trích mã theo tiền tố của account', async () => {
    await h.prisma.provider_accounts.updateMany({
      where: { provider_code: 'vietqr', external_account_ref: ACCOUNT_NUMBER },
      data: {
        config_json: {
          bankBin: '970415',
          bankName: 'VietinBank',
          accountNumber: ACCOUNT_NUMBER,
          accountName: 'CONG TY DEMO',
          referencePrefix: 'AB',
          ttlMinutes: 30,
        },
      },
    });
    const { intent, attempt } = await startCheckout('pi_vqr_prefix');
    expect(attempt.provider_order_id.startsWith('AB')).toBe(true);

    expect(
      ack(await sepay(transfer(111, 'CT ' + attempt.provider_order_id), 'apikey', false)),
    ).toMatchObject({ status: 200 });
    expect((await h.snapshot(intent.id)).intent.status).toBe('succeeded');
  });

  it('mã chuyển khoản gõ sai một ký tự -> không khớp đơn nào (ký tự kiểm tra)', async () => {
    const { intent, attempt } = await startCheckout('pi_vqr_typo');
    const reference = attempt.provider_order_id;
    const last = reference.slice(-2, -1);
    const typo = reference.slice(0, -2) + (last === 'A' ? 'B' : 'A') + reference.slice(-1);

    await sepay(transfer(112, typo));
    const s = await h.snapshot(intent.id);
    expect(s.intent.status).toBe('pending');
    expect(s.events.map((e) => e.error_message)).toEqual(['TARGET_NOT_FOUND']);
  });

  it('hasNewerAttempt trên Postgres: attempt cũ -> true, attempt mới nhất -> false', async () => {
    const { attempt: first } = await startCheckout('pi_vqr_newer');
    const second = (await h.attempts.create(h.tenant, 'pi_vqr_newer', 'k-pi_vqr_newer-2', {
      providerCode: 'vietqr',
    })) as { id: string };
    const repository = new PaymentAttemptRepository(h.prisma as unknown as PrismaService);
    const rows = await h.prisma.payment_attempts.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(await repository.hasNewerAttempt(byId.get(first.id)!)).toBe(true);
    expect(await repository.hasNewerAttempt(byId.get(second.id)!)).toBe(false);
  });

  it('xác nhận thủ công attempt của tenant khác -> 404', async () => {
    const { attempt } = await startCheckout('pi_vqr_foreign');
    await expect(
      h.operator.confirmTransfer('00000000-0000-4000-8000-000000000999', attempt.id, {
        amountMinor: 49000,
        currency: 'VND',
        bankReference: 'FT1',
        operatorRef: 'x',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
