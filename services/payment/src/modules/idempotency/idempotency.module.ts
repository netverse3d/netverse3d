import { Module } from '@nestjs/common';
import { IdempotencyRepository } from './repositories/idempotency.repository';
import { IdempotencyService } from './services/idempotency.service';

@Module({
  providers: [IdempotencyRepository, IdempotencyService],
  exports: [IdempotencyRepository, IdempotencyService],
})
export class IdempotencyModule {}
