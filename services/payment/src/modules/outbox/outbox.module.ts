import { Module } from '@nestjs/common';
import { TenantWebhooksModule } from '@app/modules/tenant-webhooks/tenant-webhooks.module';
import { OutboxAdminController } from './controllers/outbox-admin.controller';
import { OutboxProcessor } from './processors/outbox.processor';
import { PaymentOutboxDeliveryRepository } from './repositories/payment-outbox-delivery.repository';
import { PaymentOutboxRepository } from './repositories/payment-outbox.repository';
import { OutboundWebhookService } from './services/outbound-webhook.service';
import { OutboxDeliveryService } from './services/outbox-delivery.service';
import { OutboxService } from './services/outbox.service';

@Module({
  imports: [TenantWebhooksModule],
  controllers: [OutboxAdminController],
  providers: [
    PaymentOutboxRepository,
    PaymentOutboxDeliveryRepository,
    OutboundWebhookService,
    OutboxDeliveryService,
    OutboxService,
    OutboxProcessor,
  ],
  exports: [PaymentOutboxRepository, OutboxService],
})
export class OutboxModule {}
