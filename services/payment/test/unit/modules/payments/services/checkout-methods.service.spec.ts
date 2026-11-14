import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { ProviderAccountService } from '@app/modules/provider-accounts/services/provider-account.service';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { CheckoutMethodsService } from '@app/modules/payments/services/checkout-methods.service';

function service(enabled: string[], activeCodes: string[]) {
  const registry = new PaymentProviderRegistry(
    [
      new FakePaymentProvider({ code: 'vnpay' }),
      new FakePaymentProvider({ code: 'payos' }),
      new FakePaymentProvider({ code: 'vietqr', capabilities: { checkoutFlow: 'qr' } }),
    ],
    enabled,
  );
  const accounts = { activeProviderCodes: jest.fn().mockResolvedValue(activeCodes) };
  return {
    service: new CheckoutMethodsService(registry, accounts as unknown as ProviderAccountService),
    accounts,
  };
}

describe('CheckoutMethodsService', () => {
  it('chỉ trả provider BẬT và tenant có account active, kèm flow', async () => {
    const { service: methods } = service(['vnpay', 'vietqr', 'payos'], ['vietqr', 'vnpay', 'mock']);

    await expect(methods.list('tenant-1')).resolves.toEqual([
      { code: 'vnpay', flow: 'redirect' },
      { code: 'vietqr', flow: 'qr' },
    ]);
  });

  it('PAYMENT_PROVIDERS_ENABLED rỗng -> [] và không đọc DB', async () => {
    const { service: methods, accounts } = service([], ['vnpay']);

    await expect(methods.list('tenant-1')).resolves.toEqual([]);
    expect(accounts.activeProviderCodes).not.toHaveBeenCalled();
  });

  it('mã lạ trong env bị bỏ qua', async () => {
    const { service: methods } = service(['mock', 'payos'], ['payos', 'mock']);
    await expect(methods.list('tenant-1')).resolves.toEqual([{ code: 'payos', flow: 'redirect' }]);
  });
});
