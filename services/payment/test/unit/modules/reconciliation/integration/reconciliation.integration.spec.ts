import { testAppConfig } from '@test/support/test-config';
import { IT_DATABASE_URL } from '@test/support/integration-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { PrismaClient, payment_attempt_status } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { PaymentAuditLogRepository } from '@app/modules/audit/repositories/audit-log.repository';
import { AuditService } from '@netverse/nest-kit';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { ProviderAccountRepository } from '@app/modules/provider-accounts/repositories/provider-account.repository';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { PaymentWebhookEventRepository } from '@app/modules/provider-webhooks/repositories/payment-webhook-event.repository';
import { ProviderEventProcessorService } from '@app/modules/provider-webhooks/services/provider-event-processor.service';
import { ProviderEventRecorder } from '@app/modules/provider-webhooks/services/provider-event-recorder.service';
import {
  PaymentProvider,
  ProviderPaymentState,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { PaymentQueryService } from '@app/modules/payments/services/payment-query.service';
import { PaymentIntentService } from '@app/modules/payments/services/payment-intent.service';
import { CustomerService } from '@app/modules/customers/services/customer.service';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { RefundService } from '@app/modules/refunds/services/refund.service';
import { ReconciliationService } from '@app/modules/reconciliation/services/reconciliation.service';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

const PUBLIC_ID = 'pi_recon_1';

describeIntegration('ReconciliationService — tích hợp Postgres', () => {
  let prisma: PrismaClient;
  let intentId: string;
  let attemptId: string;
  let providerState: Partial<ProviderPaymentState> & { status: payment_attempt_status | null };
  let queryCalls: number;

  function queryableProvider(): PaymentProvider {
    return new FakePaymentProvider({
      code: 'fakequery',
      capabilities: { webhookReportsAmount: true },
      queryPayment: async () => {
        queryCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          providerEventId: 'ignored-by-recon',
          eventType: 'query',
          payload: { from: 'query' },
          ...providerState,
        };
      },
    });
  }

  function newService() {
    const db = prisma as unknown as PrismaService;
    const provider = queryableProvider();
    const registry = new PaymentProviderRegistry(
      [
        provider,
        new FakePaymentProvider({ code: 'fakeqr', capabilities: { webhookReportsAmount: true } }),
      ],
      [],
    );
    const intentRepository = new PaymentIntentRepository(db);
    const attemptRepository = new PaymentAttemptRepository(db);
    const processor = new ProviderEventProcessorService(
      intentRepository,
      attemptRepository,
      new PaymentOutboxRepository(db),
      new AuditService(new PaymentAuditLogRepository(db)),
    );
    const recorder = new ProviderEventRecorder(
      new PaymentWebhookEventRepository(db),
      processor,
      new TransactionRunner(db),
      { dispatchById: async () => ({}) } as unknown as OutboxService,
    );
    const accounts = new ProviderAccountResolver(
      new ProviderAccountRepository(db),
      new ProviderCredentialCipher('') as ProviderCredentialCryptoService,
    );
    const refunds = {
      reconcilePending: async () => ({ checked: 0, applied: 0, errors: 0 }),
    } as unknown as RefundService;
    const query = new PaymentQueryService(
      new PaymentIntentService(intentRepository, {} as CustomerService, {} as IdempotencyService),
    );
    return new ReconciliationService(
      attemptRepository,
      registry,
      accounts,
      recorder,
      refunds,
      query,
      testAppConfig(),
    );
  }

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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    queryCalls = 0;
    providerState = {
      status: 'succeeded',
      amountMinor: 49000n,
      currency: 'VND',
      providerPaymentId: '14000001',
    };
    await prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
    const tenant = await prisma.tenants.create({ data: { code: 'it-recon', name: 'Recon' } });
    const intent = await prisma.payment_intents.create({
      data: {
        tenant_id: tenant.id,
        public_id: PUBLIC_ID,
        target_type: 'user_subscription',
        target_ref: 'user-recon',
        target_snapshot: {},
        title: 'Recon',
        currency: 'VND',
        subtotal_minor: 49000n,
        total_minor: 49000n,
      },
    });
    const attempt = await prisma.payment_attempts.create({
      data: {
        tenant_id: tenant.id,
        payment_intent_id: intent.id,
        provider_code: 'fakequery',
        provider_order_id: 'orderref1',
        payment_method_type: 'qr_code',
        status: 'requires_action',
        started_at: new Date(Date.now() - 10 * 60_000),
      },
    });
    intentId = intent.id;
    attemptId = attempt.id;
  });

  const state = async () => ({
    intent: await prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }),
    attempt: await prisma.payment_attempts.findUniqueOrThrow({ where: { id: attemptId } }),
    outbox: await prisma.payment_outbox_events.findMany(),
    events: await prisma.payment_webhook_events.findMany(),
    audits: await prisma.auditLog.findMany(),
  });

  it('webhook bị mất: provider báo succeeded -> intent succeeded ĐÚNG MỘT lần; vòng sau không hỏi lại', async () => {
    const service = newService();

    await expect(service.runOnce()).resolves.toMatchObject({ checked: 1, applied: 1 });
    let s = await state();
    expect(s.intent.status).toBe('succeeded');
    expect(s.attempt).toMatchObject({
      status: 'succeeded',
      provider_payment_id: '14000001',
      reconcile_count: 1,
    });
    expect(s.outbox).toHaveLength(1);
    expect(s.events).toHaveLength(1);
    expect(s.events[0]).toMatchObject({
      provider_event_id: `reconcile:${attemptId}:succeeded`,
      status: 'processed',
    });

    await expect(service.runOnce()).resolves.toMatchObject({ checked: 0 });
    s = await state();
    expect(s.outbox).toHaveLength(1);
    expect(queryCalls).toBe(1);
  });

  it('provider vẫn chưa có kết quả -> unchanged, đánh dấu last_reconciled_at, giãn cách lần hỏi sau', async () => {
    providerState = { status: 'requires_action' };
    const service = newService();

    await expect(service.runOnce()).resolves.toMatchObject({ checked: 1, unchanged: 1 });
    const s = await state();
    expect(s.attempt.last_reconciled_at).not.toBeNull();
    expect(s.events).toHaveLength(0);
    await expect(service.runOnce()).resolves.toMatchObject({ checked: 0 });
  });

  it('provider báo số tiền lệch -> KHÔNG succeeded, event ignored + audit', async () => {
    providerState = { status: 'succeeded', amountMinor: 1000n, currency: 'VND' };

    await expect(newService().runOnce()).resolves.toMatchObject({ checked: 1, ignored: 1 });
    const s = await state();
    expect(s.intent.status).toBe('pending');
    expect(s.outbox).toHaveLength(0);
    expect(s.events[0]).toMatchObject({ status: 'ignored', error_message: 'AMOUNT_MISMATCH' });
    expect(s.audits[0]).toMatchObject({ action: 'payment.provider_event.rejected' });
  });

  it('provider bắt buộc số tiền (webhookReportsAmount) mà query không trả -> AMOUNT_MISSING, không succeeded', async () => {
    providerState = { status: 'succeeded' };

    await newService().runOnce();
    expect((await state()).intent.status).toBe('pending');
  });

  it('HAI worker đối soát đồng thời -> provider chỉ bị hỏi MỘT lần cho attempt đó', async () => {
    const [w1, w2] = [newService(), newService()];

    const results = await Promise.all([w1.runOnce(), w2.runOnce()]);

    expect(results.reduce((sum, r) => sum + r.checked, 0)).toBe(1);
    expect(queryCalls).toBe(1);
    expect((await state()).outbox).toHaveLength(1);
  });

  it('attempt quá trẻ (chưa qua ngưỡng tuổi) -> chưa đối soát', async () => {
    await prisma.payment_attempts.update({
      where: { id: attemptId },
      data: { started_at: new Date() },
    });

    await expect(newService().runOnce()).resolves.toMatchObject({ checked: 0 });
    expect(queryCalls).toBe(0);
  });

  it('refresh: hỏi provider NGAY (không chờ tuổi tối thiểu), giới hạn 1 lần/khoảng — lần 2 trong khoảng không hỏi lại', async () => {
    await prisma.payment_attempts.update({
      where: { id: attemptId },
      data: { started_at: new Date() },
    });
    const service = newService();
    const tenantId = (await prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }))
      .tenant_id;

    const first = (await service.refreshIntent(tenantId, PUBLIC_ID)) as {
      status: string;
      attempts: Array<{ status: string; next_action: unknown }>;
    };
    expect(first.status).toBe('succeeded');
    expect(first.attempts[0]).toMatchObject({ status: 'succeeded', next_action: null });
    expect(queryCalls).toBe(1);
    const s1 = await state();
    expect(s1.events[0]).toMatchObject({
      provider_event_id: `refresh:${attemptId}:succeeded`,
      event_type: 'refresh.succeeded',
    });

    await service.refreshIntent(tenantId, PUBLIC_ID);
    expect(queryCalls).toBe(1);
  });

  it('refresh trong khoảng giới hạn (last_reconciled_at vừa đặt) -> không hỏi provider', async () => {
    providerState = { status: 'requires_action' };
    const service = newService();
    const tenantId = (await prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }))
      .tenant_id;

    await service.refreshIntent(tenantId, PUBLIC_ID);
    await service.refreshIntent(tenantId, PUBLIC_ID);
    expect(queryCalls).toBe(1);
  });

  it('bộ quét hết hạn: provider KHÔNG queryPayment, quá expires_at + grace -> expired + outbox payment.expired; tiền về muộn -> succeeded (D4)', async () => {
    await prisma.payment_attempts.update({
      where: { id: attemptId },
      data: { provider_code: 'fakeqr', expires_at: new Date(Date.now() - 60 * 60_000) },
    });
    const service = newService();

    const result = await service.runOnce();
    expect(result.expired).toEqual({ checked: 1, applied: 1 });
    let s = await state();
    expect(s.intent.status).toBe('expired');
    expect(s.attempt).toMatchObject({ status: 'expired', failure_code: 'EXPIRED' });
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.expired']);
    expect(s.events[0]).toMatchObject({
      provider_event_id: `expire:${attemptId}`,
      status: 'processed',
    });

    await expect(service.runOnce()).resolves.toMatchObject({ expired: { checked: 0 } });

    const recorder = (service as unknown as { recorder: ProviderEventRecorder }).recorder;
    await recorder.record(
      {
        tenant_id: s.intent.tenant_id,
        payment_intent_id: intentId,
        payment_attempt_id: attemptId,
        provider_code: 'fakeqr',
        provider_event_id: 'late-transfer-1',
        event_type: 'statement.in',
        payload_json: {},
      },
      {
        status: 'succeeded',
        intentId,
        build: (sourceRef) => ({
          providerCode: 'fakeqr',
          intentId,
          attemptId,
          normalized: {
            providerEventId: 'late-transfer-1',
            eventType: 'statement.in',
            status: 'succeeded',
            amountMinor: 49000n,
            currency: 'VND',
            payload: {},
          },
          requireAmount: true,
          acceptsLateSuccess: true,
          source: 'webhook',
          sourceRef,
        }),
      },
    );
    s = await state();
    expect(s.intent.status).toBe('succeeded');
    expect(s.attempt.status).toBe('succeeded');
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.expired', 'payment.succeeded']);
  });

  it('bộ quét hết hạn: chưa quá grace -> không đóng attempt', async () => {
    await prisma.payment_attempts.update({
      where: { id: attemptId },
      data: { provider_code: 'fakeqr', expires_at: new Date(Date.now() - 60_000) },
    });

    await expect(newService().runOnce()).resolves.toMatchObject({ expired: { checked: 0 } });
    expect((await state()).attempt.status).toBe('requires_action');
  });
});
