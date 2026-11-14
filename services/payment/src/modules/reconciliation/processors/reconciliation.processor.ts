import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '@app/config/app-config';
import { ReconciliationService } from '../services/reconciliation.service';

const INTERVAL_NAME = 'reconciliation-worker';

@Injectable()
export class ReconciliationProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ReconciliationProcessor.name);
  private running = false;

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.payment.reconciliationEnabled) {
      this.logger.warn('Reconciliation disabled (RECONCILIATION_ENABLED=false)');
      return;
    }
    this.schedulerRegistry.addInterval(
      INTERVAL_NAME,
      setInterval(() => void this.tick(), this.config.payment.reconciliationIntervalMs),
    );
    this.logger.log(
      `Reconciliation started: every ${this.config.payment.reconciliationIntervalMs}ms`,
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
      const result = await this.reconciliationService.runOnce();
      if (result.checked > 0 || result.expired.checked > 0)
        this.logger.log(`Reconciliation tick: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(
        `Reconciliation tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
