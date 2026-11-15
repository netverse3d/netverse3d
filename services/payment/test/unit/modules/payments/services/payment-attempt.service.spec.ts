import { Logger } from '@nestjs/common';
import { payment_intent_status } from '@app/infrastructure/prisma/prisma.types';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { CurrentTenantPayload } from '@app/modules/auth/decorators/current-tenant.decorator';
import { IdempotencyService } from '@app/modules/idempotency/services/idempotency.service';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { ProviderTransportError } from '@app/modules/providers/shared/provider-http.client';
import { PaymentAttemptRepository } from '@app/modules/payments/repositories/payment-attempt.repository';
import { PaymentIntentRepository } from '@app/modules/payments/repositories/payment-intent.repository';
import { PaymentAttemptService } from '@app/modules/payments/services/payment-attempt.service';

const TENANT = { tenantId: 'tenant-1' } as CurrentTenantPayload;
const ACCOUNT = {
  id: 'pa-1',
  tenant_id: 'tenant-1',
  externalAccountRef: null,
  credentials: {},
  config: null,
};

function setup(
  intentStatus: payment_intent_status = 'pending',
  options: { enabled?: string[]; attempts?: unknown[] } = {},
) {
  const intentRepo = {
    findByPublicId: jest.fn().mockResolvedValue({
      id: 'intent-1',
      public_id: 'pi_pub_1',
      status: intentStatus,
      total_minor: 49000n,
      currency: 'VND',
      title: 'Pro',
      attempts: options.attempts ?? [],
    }),
  };
  const attemptRepo = {
    create: jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) => Promise.resolve({ ...data })),
    nextOrderNumber: jest.fn().mockResolvedValue(1234n),
  };
  const accounts = {
    activeByTenant: jest.fn().mockResolvedValue(ACCOUNT),
    byId: jest.fn().mockResolvedValue(ACCOUNT),
  };
  const idempotency = {
    execute: jest.fn(
      async (_context: unknown, operation: () => Promise<{ response: unknown }>) =>
        (await operation()).response,
    ),
  };
  const cancelCheckout = jest.fn().mockResolvedValue(undefined);
  const fake = new FakePaymentProvider({ cancelCheckout });
  const checkoutSpy = jest.spyOn(fake, 'createCheckout');
  const service = new PaymentAttemptService(
    intentRepo as unknown as PaymentIntentRepository,
    attemptRepo as unknown as PaymentAttemptRepository,
    accounts as unknown as ProviderAccountResolver,
    new PaymentProviderRegistry([fake], options.enabled ?? ['fake']),
    idempotency as unknown as IdempotencyService,
  );
  return { service, attemptRepo, idempotency, checkoutSpy, accounts, cancelCheckout, fake };
}

describe('PaymentAttemptService.create', () => {
  it('truyền request context + mã đơn hàng + số đơn + thời điểm tạo xuống provider, lưu vào attempt', async () => {
    const { service, attemptRepo, checkoutSpy } = setup();

    const view = (await service.create(TENANT, 'pi_pub_1', 'key-1', {
      providerCode: 'fake',
      clientIp: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      locale: 'vi',
    })) as Record<string, unknown>;

    const input = checkoutSpy.mock.calls[0]![0];
    expect(input.context).toEqual({
      clientIp: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      locale: 'vi',
    });
    expect(input.providerAccount).toMatchObject({ id: 'pa-1' });
    expect(input.orderNumber).toBe(1234n);
    expect(input.attemptId).toBe(attemptRepo.create.mock.calls[0][0].id);
    const created = attemptRepo.create.mock.calls[0][0];
    expect(input.providerOrderRef).toBe(created.id.replace(/-/g, ''));
    expect(created.started_at).toBe(input.createdAt);
    expect(created).toMatchObject({
      order_number: 1234n,
      provider_order_id: input.providerOrderRef,
      provider_payment_id: 'fake_pi_pub_1',
      request_payload: {
        clientIp: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
        locale: 'vi',
        returnUrl: null,
        provider: { orderNumber: '1234' },
        nextAction: { type: 'redirect', url: `https://fake.test/pay/${input.providerOrderRef}` },
      },
    });
    expect(view.next_action).toEqual({
      type: 'redirect',
      url: `https://fake.test/pay/${input.providerOrderRef}`,
    });
  });

  it('hash idempotency KHÔNG gồm clientIp/userAgent (đổi mạng rồi retry không 409)', async () => {
    const { service, idempotency } = setup();

    await service.create(TENANT, 'pi_pub_1', 'key-1', {
      providerCode: 'fake',
      clientIp: '203.0.113.7',
      userAgent: 'UA',
    });

    expect(idempotency.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        key: 'key-1',
        requestPayload: {
          publicId: 'pi_pub_1',
          providerCode: 'fake',
          returnUrl: undefined,
          locale: undefined,
        },
      }),
      expect.any(Function),
    );
  });

  it.each([
    'processing',
    'succeeded',
    'canceled',
    'expired',
    'refunded',
    'partially_refunded',
  ] as const)('intent %s -> 409, không gọi provider', async (status) => {
    const { service, checkoutSpy } = setup(status);

    await expect(
      service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(checkoutSpy).not.toHaveBeenCalled();
  });

  it.each(['pending', 'requires_action', 'failed'] as const)(
    'intent %s -> cho tạo attempt',
    async (status) => {
      const { service, checkoutSpy } = setup(status);

      await service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' });
      expect(checkoutSpy).toHaveBeenCalled();
    },
  );

  it('provider không nằm trong PAYMENT_PROVIDERS_ENABLED -> 422 PROVIDER_DISABLED, không cấp số đơn', async () => {
    const { service, checkoutSpy, attemptRepo } = setup('pending', { enabled: [] });

    await expect(
      service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' }),
    ).rejects.toMatchObject({
      status: 422,
      details: { reason: 'PROVIDER_DISABLED' },
    });
    expect(checkoutSpy).not.toHaveBeenCalled();
    expect(attemptRepo.nextOrderNumber).not.toHaveBeenCalled();
  });

  it('tenant chưa có account active -> 422 PROVIDER_ACCOUNT_MISSING', async () => {
    const { service, accounts, checkoutSpy } = setup();
    accounts.activeByTenant.mockResolvedValueOnce(null);

    await expect(
      service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' }),
    ).rejects.toMatchObject({
      status: 422,
      details: { reason: 'PROVIDER_ACCOUNT_MISSING' },
    });
    expect(checkoutSpy).not.toHaveBeenCalled();
  });

  it('provider timeout -> 504 GATEWAY_TIMEOUT, không tạo attempt', async () => {
    const { service, checkoutSpy, attemptRepo } = setup();
    checkoutSpy.mockRejectedValueOnce(new ProviderTransportError('timed out', 'timeout'));

    await expect(
      service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' }),
    ).rejects.toMatchObject({
      status: 504,
      details: { reason: 'GATEWAY_TIMEOUT' },
    });
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('provider lỗi khác -> 502 GATEWAY_ERROR', async () => {
    const { service, checkoutSpy } = setup();
    checkoutSpy.mockRejectedValueOnce(new Error('boom'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(
      service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' }),
    ).rejects.toMatchObject({
      status: 502,
      details: { reason: 'GATEWAY_ERROR' },
    });
  });

  it('attempt mở cũ của provider có cancelCheckout -> huỷ (best effort) trước khi tạo attempt mới', async () => {
    const { service, cancelCheckout, checkoutSpy } = setup('requires_action', {
      attempts: [
        {
          id: 'old-1',
          tenant_id: 'tenant-1',
          status: 'requires_action',
          provider_code: 'fake',
          provider_account_id: 'pa-1',
          order_number: 7n,
          provider_order_id: '7',
          provider_payment_id: null,
          request_payload: {},
        },
        {
          id: 'old-2',
          tenant_id: 'tenant-1',
          status: 'failed',
          provider_code: 'fake',
          provider_account_id: 'pa-1',
          order_number: 8n,
          provider_order_id: '8',
          provider_payment_id: null,
          request_payload: {},
        },
      ],
    });
    cancelCheckout.mockRejectedValueOnce(new Error('payOS down'));

    await service.create(TENANT, 'pi_pub_1', 'key-1', { providerCode: 'fake' });

    expect(cancelCheckout).toHaveBeenCalledTimes(1);
    expect(cancelCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId: 'old-1', orderNumber: 7n }),
    );
    expect(checkoutSpy).toHaveBeenCalled();
  });
});
