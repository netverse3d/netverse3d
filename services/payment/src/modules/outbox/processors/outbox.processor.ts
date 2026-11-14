import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '@app/config/app-config';
import { OutboxDeliveryService } from '../services/outbox-delivery.service';

const INTERVAL_NAME = 'outbox-worker';

@Injectable()
export class OutboxProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxProcessor.name);
  private running = false;

  constructor(
    private readonly deliveryService: OutboxDeliveryService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.payment.outboxWorkerEnabled) {
      this.logger.warn(
        'Outbox worker disabled (OUTBOX_WORKER_ENABLED=false): events are delivered only on manual dispatch',
      );
      return;
    }
    this.schedulerRegistry.addInterval(
      INTERVAL_NAME,
      setInterval(() => void this.tick(), this.config.payment.outboxWorkerIntervalMs),
    );
    this.logger.log(
      `Outbox worker started: every ${this.config.payment.outboxWorkerIntervalMs}ms, worker ${this.deliveryService.workerId}`,
    );
  }

  onApplicationShutdown() {
    if (this.schedulerRegistry.doesExist('interval', INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(INTERVAL_NAME);
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.deliveryService.runOnce();
      if (result.attempted > 0 || result.fannedOut > 0) {
        this.logger.log(`Outbox tick: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      this.logger.error(
        `Outbox tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
