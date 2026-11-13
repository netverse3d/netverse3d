import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { LockedJob } from '@netverse/nest-kit';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DeliveryDispatcherService } from '../services/delivery-dispatcher.service';

const DELIVERY_LOCK_ID = 7301;

@Injectable()
export class DeliveryDispatchJob extends LockedJob {
  constructor(
    prisma: PrismaService,
    config: AppConfig,
    private readonly dispatcher: DeliveryDispatcherService,
  ) {
    super(prisma, DELIVERY_LOCK_ID, config.delivery.pollIntervalMs, config.jobs.enabled);
  }

  protected work(): Promise<number> {
    return this.dispatcher.dispatchBatch();
  }
}
