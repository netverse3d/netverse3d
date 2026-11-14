import { Module } from '@nestjs/common';
import { OutboxModule } from '@app/modules/outbox/outbox.module';
import { PaymentsModule } from '@app/modules/payments/payments.module';
import { ProviderAccountsModule } from '@app/modules/provider-accounts/provider-accounts.module';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { OperatorConfirmController } from './controllers/operator-confirm.controller';
import { ProviderWebhookController } from './controllers/provider-webhook.controller';
import { PaymentWebhookEventRepository } from './repositories/payment-webhook-event.repository';
import { OperatorConfirmService } from './services/operator-confirm.service';
import { ProviderEventProcessorService } from './services/provider-event-processor.service';
import { ProviderEventRecorder } from './services/provider-event-recorder.service';
import { ProviderWebhookService } from './services/provider-webhook.service';

@Module({
  imports: [ProvidersModule, PaymentsModule, OutboxModule, ProviderAccountsModule],
  controllers: [ProviderWebhookController, OperatorConfirmController],
  providers: [
    PaymentWebhookEventRepository,
    ProviderEventProcessorService,
    ProviderEventRecorder,
    ProviderWebhookService,
    OperatorConfirmService,
  ],
  exports: [ProviderEventRecorder],
})
export class ProviderWebhooksModule {}
