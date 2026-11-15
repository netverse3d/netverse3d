import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDERS_ENABLED,
  PaymentProvider,
} from '../contracts/payment-provider.contract';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: readonly PaymentProvider[];
  private readonly enabled: ReadonlySet<string>;

  constructor(
    @Inject(PAYMENT_PROVIDERS) providers: readonly PaymentProvider[],
    @Inject(PAYMENT_PROVIDERS_ENABLED) enabledCodes: readonly string[],
  ) {
    const seen = new Set<string>();
    for (const provider of providers) {
      if (seen.has(provider.code))
        throw new Error(`Payment provider "${provider.code}" is registered twice`);
      seen.add(provider.code);
    }
    this.providers = [...providers];
    this.enabled = new Set(
      enabledCodes.map((code) => code.trim().toLowerCase()).filter((code) => seen.has(code)),
    );
  }

  list() {
    return this.providers.map((provider) => ({
      code: provider.code,
      enabled: this.enabled.has(provider.code),
    }));
  }

  listEnabled() {
    return this.providers.filter(
      (provider) => this.enabled.has(provider.code) && provider.capabilities().checkout,
    );
  }

  isEnabled(code: string) {
    return this.enabled.has(code);
  }

  refundQueryable() {
    return this.providers.filter(
      (provider) => provider.capabilities().refund && typeof provider.queryRefund === 'function',
    );
  }

  queryable() {
    return this.providers.filter(
      (provider) =>
        provider.capabilities().queryPayment && typeof provider.queryPayment === 'function',
    );
  }

  notQueryable() {
    return this.providers.filter(
      (provider) =>
        !provider.capabilities().queryPayment || typeof provider.queryPayment !== 'function',
    );
  }

  find(code: string) {
    return this.providers.find((item) => item.code === code) ?? null;
  }

  get(code: string) {
    const provider = this.find(code);
    if (!provider)
      throw new AppException(PaymentErrorCode.PROVIDER_NOT_SUPPORTED, {
        message: `Provider "${code}" is not supported`,
        details: { reason: 'PROVIDER_NOT_SUPPORTED' },
      });
    return provider;
  }

  getForCheckout(code: string) {
    const provider = this.get(code);
    if (!this.enabled.has(provider.code) || !provider.capabilities().checkout) {
      throw new AppException(PaymentErrorCode.PROVIDER_DISABLED, {
        message: `Payment gateway "${code}" is currently closed`,
        details: { reason: 'PROVIDER_DISABLED' },
      });
    }
    return provider;
  }
}
