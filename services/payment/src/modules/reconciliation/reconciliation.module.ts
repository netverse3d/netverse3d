import { Module } from '@nestjs/common';
import { PaymentsModule } from '@app/modules/payments/payments.module';
import { ProviderAccountsModule } from '@app/modules/provider-accounts/provider-accounts.module';
import { ProviderWebhooksModule } from '@app/modules/provider-webhooks/provider-webhooks.module';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { RefundsModule } from '@app/modules/refunds/refunds.module';
import { PaymentRefreshController } from './controllers/payment-refresh.controller';
import { ReconciliationAdminController } from './controllers/reconciliation-admin.controller';
import { ReconciliationProcessor } from './processors/reconciliation.processor';
import { ReconciliationService } from './services/reconciliation.service';

@Module({
  imports: [
    PaymentsModule,
    ProvidersModule,
    ProviderAccountsModule,
    ProviderWebhooksModule,
    RefundsModule,
  ],
  controllers: [ReconciliationAdminController, PaymentRefreshController],
  providers: [ReconciliationService, ReconciliationProcessor],
})
export class ReconciliationModule {}
