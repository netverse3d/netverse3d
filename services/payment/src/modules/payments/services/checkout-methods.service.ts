import { Injectable } from '@nestjs/common';
import { ProviderAccountService } from '@app/modules/provider-accounts/services/provider-account.service';
import { ProviderCheckoutFlow } from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';

export interface CheckoutMethodView {
  code: string;
  flow: ProviderCheckoutFlow;
}

@Injectable()
export class CheckoutMethodsService {
  constructor(
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly providerAccounts: ProviderAccountService,
  ) {}

  async list(tenantId: string): Promise<CheckoutMethodView[]> {
    const enabled = this.providerRegistry.listEnabled();
    if (enabled.length === 0) return [];
    const active = new Set(await this.providerAccounts.activeProviderCodes(tenantId));
    return enabled
      .filter((provider) => active.has(provider.code))
      .map((provider) => ({ code: provider.code, flow: provider.capabilities().checkoutFlow }));
  }
}
