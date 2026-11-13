import { Injectable } from '@nestjs/common';
import { KitConfig } from '../../../config/kit-config';
import { Database } from '../../../infrastructure/database/database';
import { LockedJob } from '../../../infrastructure/jobs/locked-job';
import { EventContracts, InvalidEventError } from '../domain/event-contracts';
import { toEnvelope } from '../domain/event-envelope';
import { EventPublisher } from '../ports/event-publisher';
import { OutboxRepository, OutboxRow } from '../repositories/outbox.repository';

const OUTBOX_LOCK_ID = 7104;
const BATCH_SIZE = 100;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15 * 60_000;
const MAX_BACKOFF_STEPS = 20;

type Delivery = 'published' | 'buried' | 'postponed';

export function retryDelayMs(attempts: number): number {
  const steps = Math.min(Math.max(attempts - 1, 0), MAX_BACKOFF_STEPS);
  return Math.min(BASE_RETRY_MS * 2 ** steps, MAX_RETRY_MS);
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
    const rows = await this.repository.findPendingInOrder(BATCH_SIZE);
    let handled = 0;
    for (const row of rows) {
      if (row.nextAttemptAt.getTime() > Date.now()) {
        break;
      }
      if ((await this.deliver(row)) === 'postponed') {
        break;
      }
      handled += 1;
    }
    return handled;
  }

  private async deliver(row: OutboxRow): Promise<Delivery> {
    try {
      const event = toEnvelope(row, this.config.service.name);
      this.contracts.assertValid(event);
      await this.publisher.publish(event);
      await this.repository.markPublished(row.id);
      return 'published';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = row.attempts + 1;
      if (error instanceof InvalidEventError) {
        await this.repository.markFailed(row.id, attempts, null, message);
        this.logger.error(`event ${row.id} breaks its contract and was set aside: ${message}`);
        return 'buried';
      }
      const nextAttemptAt = new Date(Date.now() + retryDelayMs(attempts));
      await this.repository.markFailed(row.id, attempts, nextAttemptAt, message);
      const report = `event ${row.id} failed on attempt ${attempts}: ${message}`;
      if (attempts >= this.config.jobs.outboxMaxAttempts) {
        this.logger.error(`${report}; the outbox is blocked behind it`);
      } else {
        this.logger.warn(report);
      }
      return 'postponed';
    }
  }
}
