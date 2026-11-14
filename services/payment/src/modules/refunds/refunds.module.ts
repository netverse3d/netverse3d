import { Module } from '@nestjs/common';
import { IdempotencyModule } from '@app/modules/idempotency/idempotency.module';
import { OutboxModule } from '@app/modules/outbox/outbox.module';
import { PaymentsModule } from '@app/modules/payments/payments.module';
import { ProviderAccountsModule } from '@app/modules/provider-accounts/provider-accounts.module';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { RefundController } from './controllers/refund.controller';
import { RefundRepository } from './repositories/refund.repository';
import { RefundProcessorService } from './services/refund-processor.service';
import { RefundService } from './services/refund.service';

@Module({
  imports: [
    PaymentsModule,
    ProvidersModule,
    ProviderAccountsModule,
    IdempotencyModule,
    OutboxModule,
  ],
  controllers: [RefundController],
  providers: [RefundRepository, RefundProcessorService, RefundService],
  exports: [RefundService],
})
export class RefundsModule {}
