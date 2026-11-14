import { Module } from '@nestjs/common';
import { CustomersModule } from '@app/modules/customers/customers.module';
import { IdempotencyModule } from '@app/modules/idempotency/idempotency.module';
import { ProviderAccountsModule } from '@app/modules/provider-accounts/provider-accounts.module';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { CheckoutMethodsController } from './controllers/checkout-methods.controller';
import { PaymentAdminController } from './controllers/payment-admin.controller';
import { PaymentPublicController } from './controllers/payment-public.controller';
import { PaymentAttemptRepository } from './repositories/payment-attempt.repository';
import { PaymentIntentRepository } from './repositories/payment-intent.repository';
import { CheckoutMethodsService } from './services/checkout-methods.service';
import { PaymentAttemptService } from './services/payment-attempt.service';
import { PaymentIntentService } from './services/payment-intent.service';
import { PaymentQueryService } from './services/payment-query.service';

@Module({
  imports: [CustomersModule, IdempotencyModule, ProviderAccountsModule, ProvidersModule],
  controllers: [PaymentPublicController, PaymentAdminController, CheckoutMethodsController],
  providers: [
    PaymentIntentRepository,
    PaymentAttemptRepository,
    PaymentIntentService,
    PaymentAttemptService,
    PaymentQueryService,
    CheckoutMethodsService,
  ],
  exports: [
    PaymentIntentRepository,
    PaymentAttemptRepository,
    PaymentIntentService,
    PaymentQueryService,
  ],
})
export class PaymentsModule {}
