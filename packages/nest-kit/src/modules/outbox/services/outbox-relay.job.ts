import { Injectable } from '@nestjs/common';
import { KitConfig } from '../../../config/kit-config';
import { LockedJob } from '../../../infrastructure/jobs/locked-job';
import { Database } from '../../../infrastructure/database/database';
import { EventContracts, InvalidEventError } from '../domain/event-contracts';
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
    database: Database,
    private readonly config: KitConfig,
    private readonly repository: OutboxRepository,
    private readonly publisher: EventPublisher,
    private readonly contracts: EventContracts,
  ) {
    super(database, OUTBOX_LOCK_ID, config.jobs.outboxRelayIntervalMs, config.jobs.enabled);
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
      const event = toEnvelope(row, this.config.service.name);
      this.contracts.assertValid(event);
      await this.publisher.publish(event);
      await this.repository.markPublished(row.id);
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted =
        error instanceof InvalidEventError || attempts >= this.config.jobs.outboxMaxAttempts;
      const nextAttemptAt = exhausted ? null : new Date(Date.now() + retryDelayMs(attempts));
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.markFailed(row.id, attempts, nextAttemptAt, message);
      this.logger.warn(`event ${row.id} failed on attempt ${attempts}: ${message}`);
    }
  }
}
