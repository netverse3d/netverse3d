import { testAppConfig } from '@test/support/test-config';
import { IT_DATABASE_URL } from '@test/support/integration-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { PrismaClient } from '@app/infrastructure/prisma/client';
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
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { ProviderAccountRepository } from '@app/modules/provider-accounts/repositories/provider-account.repository';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import {
  PaymentProvider,
  ProviderRefundState,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { RefundRepository } from '@app/modules/refunds/repositories/refund.repository';
import { RefundProcessorService } from '@app/modules/refunds/services/refund-processor.service';
import { RefundService } from '@app/modules/refunds/services/refund.service';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

const PUBLIC_ID = 'pi_refund_1';

describeIntegration('RefundService — tích hợp Postgres', () => {
  let prisma: PrismaClient;
  let tenant: CurrentTenantPayload;
  let intentId: string;
  let createBehaviour: () => Promise<ProviderRefundState>;
  let queryBehaviour: () => Promise<ProviderRefundState>;
  let createCalls: number;

  function refundProvider(): PaymentProvider {
    return new FakePaymentProvider({
      code: 'fakerefund',
      createRefund: async () => {
        createCalls += 1;
        return createBehaviour();
      },
      queryRefund: async () => queryBehaviour(),
    });
  }

  function newService() {
    const db = prisma as unknown as PrismaService;
    const provider = refundProvider();
    const registry = {
      get: () => provider,
      refundQueryable: () => [provider],
    } as unknown as PaymentProviderRegistry;
    const refundRepository = new RefundRepository(db);
    const intentRepository = new PaymentIntentRepository(db);
    return new RefundService(
      refundRepository,
      intentRepository,
      registry,
      new ProviderAccountResolver(
        new ProviderAccountRepository(db),
        new ProviderCredentialCipher('') as ProviderCredentialCryptoService,
      ),
      new IdempotencyService(new IdempotencyRepository(db)),
      new RefundProcessorService(
        refundRepository,
        intentRepository,
        new PaymentOutboxRepository(db),
        new AuditService(new PaymentAuditLogRepository(db)),
      ),
      new TransactionRunner(db),
      { dispatchById: async () => ({}) } as unknown as OutboxService,
      testAppConfig(),
    );
  }

  const succeeded = (id = 'prov_rf'): ProviderRefundState => ({
    status: 'succeeded',
    providerRefundId: id,
    payload: { ok: true },
  });

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
    createCalls = 0;
    createBehaviour = async () => succeeded();
    queryBehaviour = async () => succeeded();
    await prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
    const row = await prisma.tenants.create({ data: { code: 'it-refund', name: 'Refund' } });
    tenant = { tenantId: row.id, tenantCode: row.code };
    const intent = await prisma.payment_intents.create({
      data: {
        tenant_id: row.id,
        public_id: PUBLIC_ID,
        target_type: 'user_subscription',
        target_ref: 'user-refund',
        target_snapshot: {},
        title: 'Refund',
        currency: 'VND',
        subtotal_minor: 100000n,
        total_minor: 100000n,
        status: 'succeeded',
        paid_at: new Date(),
      },
    });
    await prisma.payment_attempts.create({
      data: {
        tenant_id: row.id,
        payment_intent_id: intent.id,
        provider_code: 'fakerefund',
        provider_order_id: 'ord1',
        provider_payment_id: 'pay1',
        payment_method_type: 'qr_code',
        status: 'succeeded',
      },
    });
    intentId = intent.id;
  });

  const snapshot = async () => ({
    intent: await prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } }),
    refunds: await prisma.refunds.findMany({ orderBy: { created_at: 'asc' } }),
    outbox: await prisma.payment_outbox_events.findMany({ orderBy: { id: 'asc' } }),
  });

  it('hoàn TOÀN BỘ (bỏ trống amount) -> refund succeeded, intent refunded, outbox payment.refunded', async () => {
    const refund = (await newService().create(tenant, PUBLIC_ID, 'rf-full', {})) as {
      status: string;
      amount_minor: bigint;
    };

    expect(refund).toMatchObject({ status: 'succeeded' });
    const s = await snapshot();
    expect(s.intent.status).toBe('refunded');
    expect(s.refunds[0]).toMatchObject({
      amount_minor: 100000n,
      status: 'succeeded',
      provider_refund_id: 'prov_rf',
    });
    expect(s.refunds[0]!.request_payload).toMatchObject({ isFullRefund: true });
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.refunded']);
  });

  it('hai lần hoàn MỘT PHẦN -> partially_refunded rồi refunded', async () => {
    const service = newService();

    await service.create(tenant, PUBLIC_ID, 'rf-p1', { amountMinor: 30000 });
    expect((await snapshot()).intent.status).toBe('partially_refunded');
    await service.create(tenant, PUBLIC_ID, 'rf-p2', { amountMinor: 70000 });

    const s = await snapshot();
    expect(s.intent.status).toBe('refunded');
    expect(s.outbox.map((e) => e.event_type)).toEqual([
      'payment.partially_refunded',
      'payment.refunded',
    ]);
    expect(s.outbox[0]!.payload_json).toMatchObject({
      refundedTotalMinor: '30000',
      status: 'partially_refunded',
    });
  });

  it('lần hoàn MỘT PHẦN thứ hai vẫn phát payment.partially_refunded (G-PAY-20), tổng luỹ kế đúng', async () => {
    const service = newService();

    await service.create(tenant, PUBLIC_ID, 'rf-q1', { amountMinor: 20000 });
    await service.create(tenant, PUBLIC_ID, 'rf-q2', { amountMinor: 30000 });
    await service.create(tenant, PUBLIC_ID, 'rf-q3', { amountMinor: 50000 });

    const s = await snapshot();
    expect(s.intent.status).toBe('refunded');
    expect(s.outbox.map((e) => e.event_type)).toEqual([
      'payment.partially_refunded',
      'payment.partially_refunded',
      'payment.refunded',
    ]);
    expect(s.outbox[1]!.payload_json).toMatchObject({
      refundedTotalMinor: '50000',
      status: 'partially_refunded',
      refundAmountMinor: '30000',
    });
  });

  it('hoàn VƯỢT số còn lại -> 422, không gọi provider, không tạo refund', async () => {
    const service = newService();
    await service.create(tenant, PUBLIC_ID, 'rf-a', { amountMinor: 60000 });

    await expect(
      service.create(tenant, PUBLIC_ID, 'rf-b', { amountMinor: 50000 }),
    ).rejects.toMatchObject({ status: 422 });
    expect(createCalls).toBe(1);
    expect((await snapshot()).refunds).toHaveLength(1);
  });

  it('HAI request đồng thời mỗi cái 60% -> chỉ MỘT được giữ chỗ, không bao giờ hoàn vượt 100%', async () => {
    const [a, b] = [newService(), newService()];

    const results = await Promise.allSettled([
      a.create(tenant, PUBLIC_ID, 'rf-c1', { amountMinor: 60000 }),
      b.create(tenant, PUBLIC_ID, 'rf-c2', { amountMinor: 60000 }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
    expect(rejected.reason).toMatchObject({ status: 422 });
    const s = await snapshot();
    expect(s.refunds).toHaveLength(1);
    expect(s.intent.status).toBe('partially_refunded');
  });

  it('provider TỪ CHỐI -> refund failed + outbox payment.refund.failed, intent vẫn succeeded, số tiền được nhả', async () => {
    createBehaviour = async () => ({
      status: 'failed',
      failureReason: 'Merchant balance insufficient',
      payload: { code: '94' },
    });
    const service = newService();

    await expect(service.create(tenant, PUBLIC_ID, 'rf-fail', {})).resolves.toMatchObject({
      status: 'failed',
    });
    let s = await snapshot();
    expect(s.intent.status).toBe('succeeded');
    expect(s.refunds[0]).toMatchObject({
      status: 'failed',
      failure_reason: 'Merchant balance insufficient',
    });
    expect(s.outbox.map((e) => e.event_type)).toEqual(['payment.refund.failed']);

    createBehaviour = async () => succeeded('prov_rf_2');
    await service.create(tenant, PUBLIC_ID, 'rf-after-fail', {});
    s = await snapshot();
    expect(s.intent.status).toBe('refunded');
  });

  it('createRefund lỗi mạng -> refund GIỮ pending (không đoán failed); reconciliation queryRefund chốt succeeded', async () => {
    createBehaviour = async () => {
      throw new Error('socket hang up');
    };
    const service = newService();

    await expect(
      service.create(tenant, PUBLIC_ID, 'rf-net', { amountMinor: 40000 }),
    ).resolves.toMatchObject({ status: 'pending' });
    let s = await snapshot();
    expect(s.refunds[0]!.status).toBe('pending');
    expect(s.intent.status).toBe('succeeded');
    await expect(
      service.create(tenant, PUBLIC_ID, 'rf-net-2', { amountMinor: 70000 }),
    ).rejects.toMatchObject({ status: 422 });

    await prisma.refunds.updateMany({
      data: { last_reconciled_at: new Date(Date.now() - 3_600_000) },
    });
    queryBehaviour = async () => succeeded('prov_rf_net');
    await expect(service.reconcilePending()).resolves.toMatchObject({ checked: 1, applied: 1 });

    s = await snapshot();
    expect(s.refunds[0]).toMatchObject({ status: 'succeeded', provider_refund_id: 'prov_rf_net' });
    expect(s.intent.status).toBe('partially_refunded');
  });

  it('cùng idempotency-key -> replay, KHÔNG gọi provider lần hai', async () => {
    const service = newService();

    const first = (await service.create(tenant, PUBLIC_ID, 'rf-idem', { amountMinor: 10000 })) as {
      id: string;
    };
    const second = (await service.create(tenant, PUBLIC_ID, 'rf-idem', { amountMinor: 10000 })) as {
      id: string;
    };

    expect(second.id).toBe(first.id);
    expect(createCalls).toBe(1);
    expect((await snapshot()).refunds).toHaveLength(1);
  });

  it('intent chưa thanh toán -> 409', async () => {
    await prisma.payment_intents.update({ where: { id: intentId }, data: { status: 'pending' } });

    await expect(newService().create(tenant, PUBLIC_ID, 'rf-unpaid', {})).rejects.toMatchObject({
      status: 409,
    });
    expect(createCalls).toBe(0);
  });
});
