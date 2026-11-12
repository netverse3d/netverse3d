import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { LockedJob } from '../../../infrastructure/jobs/locked-job';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { toEnvelope } from '../domain/event-envelope';
import { EventPublisher } from '../ports/event-publisher';
import { OutboxRepository, OutboxRow } from '../repositories/outbox.repository';

const OUTBOX_LOCK_ID = 7104;
const BATCH_SIZE = 100;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15 * 60_000;

export function retryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** (attempts - 1), MAX_RETRY_MS);
}

@Injectable()
export class OutboxRelayJob extends LockedJob {
  constructor(
    prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly repository: OutboxRepository,
    private readonly publisher: EventPublisher,
  ) {
    super(prisma, OUTBOX_LOCK_ID, config.jobs.outboxRelayIntervalMs, config.jobs.enabled);
  }

  protected async work(): Promise<number> {
    const rows = await this.repository.findDue(BATCH_SIZE);
    for (const row of rows) {
      await this.deliver(row);
    }
    return rows.length;
  }

  private async deliver(row: OutboxRow): Promise<void> {
    try {
      await this.publisher.publish(toEnvelope(row, this.config.service.name));
      await this.repository.markPublished(row.id);
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= this.config.jobs.outboxMaxAttempts;
      const nextAttemptAt = exhausted ? null : new Date(Date.now() + retryDelayMs(attempts));
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.markFailed(row.id, attempts, nextAttemptAt, message);
      this.logger.warn(`event ${row.id} failed on attempt ${attempts}: ${message}`);
    }
  }
}
