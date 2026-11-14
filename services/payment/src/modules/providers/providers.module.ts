import { Module, Type } from '@nestjs/common';
import { AppConfig } from '@app/config/app-config';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDERS_ENABLED,
  PROVIDER_RUNTIME_CONFIG,
  PaymentProvider,
  ProviderRuntimeConfig,
} from './contracts/payment-provider.contract';
import { PayosProvider } from './payos/payos.provider';
import { PaymentProviderRegistry } from './registry/payment-provider.registry';
import { BankTransferQrProvider } from './vietqr/vietqr.provider';
import { VnpayProvider } from './vnpay/vnpay.provider';

const PROVIDER_CLASSES: Type<PaymentProvider>[] = [
  VnpayProvider,
  PayosProvider,
  BankTransferQrProvider,
];

@Module({
  providers: [
    {
      provide: PROVIDER_RUNTIME_CONFIG,
      inject: [AppConfig],
      useFactory: (config: AppConfig): ProviderRuntimeConfig => ({
        httpTimeoutMs: config.payment.providerHttpTimeoutMs,
        expiryGraceMinutes: config.payment.expiryGraceMinutes,
        serverIp: config.payment.reconciliationServerIp,
        vnpayPaymentUrl: config.payment.vnpayPaymentUrl,
        vnpayApiUrl: config.payment.vnpayApiUrl,
        payosApiBaseUrl: config.payment.payosApiBaseUrl,
        payosOrderCodeOffset: config.payment.payosOrderCodeOffset,
      }),
    },
    ...PROVIDER_CLASSES,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (...providers: PaymentProvider[]) => providers,
      inject: PROVIDER_CLASSES,
    },
    {
      provide: PAYMENT_PROVIDERS_ENABLED,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => config.payment.providersEnabled,
    },
    PaymentProviderRegistry,
  ],
  exports: [PaymentProviderRegistry, PROVIDER_RUNTIME_CONFIG],
})
export class ProvidersModule {}
