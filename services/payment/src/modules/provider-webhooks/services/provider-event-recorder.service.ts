import { Injectable, Logger } from '@nestjs/common';
import {
  WebhookEventCreateInput,
  payment_attempt_status,
} from '@app/infrastructure/prisma/prisma.types';
import { PrismaDb, TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { OutboxService } from '@app/modules/outbox/services/outbox.service';
import { PaymentWebhookEventRepository } from '../repositories/payment-webhook-event.repository';
import {
  ProviderEventInput,
  ProviderEventOutcome,
  ProviderEventProcessorService,
} from './provider-event-processor.service';

export const TARGET_NOT_FOUND = 'TARGET_NOT_FOUND';

export interface ProviderEventPlan {
  status: payment_attempt_status | null | undefined;
  intentId: string | null;
  build: (sourceRef: string) => ProviderEventInput;
  onApplied?: (
    tx: PrismaDb,
    outcome: Extract<ProviderEventOutcome, { kind: 'applied' }>,
  ) => Promise<void>;
}

export type ProviderEventRecordResult =
  | {
      kind: 'duplicate';
      webhookEventId: string;
      previousStatus: string | null;
      previousReason: string | null;
    }
  | { kind: 'skipped'; webhookEventId: string }
  | { kind: 'unmatched'; webhookEventId: string }
  | { kind: 'done'; webhookEventId: string; outcome: ProviderEventOutcome };

@Injectable()
export class ProviderEventRecorder {
  private readonly logger = new Logger(ProviderEventRecorder.name);

  constructor(
    private readonly repository: PaymentWebhookEventRepository,
    private readonly processor: ProviderEventProcessorService,
    private readonly transactions: TransactionRunner,
    private readonly outboxService: OutboxService,
  ) {}

  async record(
    eventData: WebhookEventCreateInput,
    plan: ProviderEventPlan,
  ): Promise<ProviderEventRecordResult> {
    let result: ProviderEventRecordResult;
    try {
      result = await this.transactions.run(async (tx) => {
        const claim = await this.repository.claim(eventData, tx);
        if (!claim.claimed) {
          return {
            kind: 'duplicate' as const,
            webhookEventId: claim.row.id,
            previousStatus: claim.row.status ?? null,
            previousReason: claim.row.error_message ?? null,
          };
        }

        if (!plan.status) {
          await this.repository.markOutcome(claim.row.id, 'ignored', 'NO_STATUS', tx);
          return { kind: 'skipped' as const, webhookEventId: claim.row.id };
        }
        if (!plan.intentId) {
          await this.repository.markOutcome(claim.row.id, 'ignored', TARGET_NOT_FOUND, tx);
          return { kind: 'unmatched' as const, webhookEventId: claim.row.id };
        }

        const outcome = await this.processor.apply(tx, plan.build(claim.row.id));
        await this.repository.markOutcome(
          claim.row.id,
          outcome.kind === 'applied' ? 'processed' : 'ignored',
          outcome.kind === 'ignored' ? outcome.reason : null,
          tx,
        );
        if (outcome.kind === 'applied' && plan.onApplied) await plan.onApplied(tx, outcome);
        return { kind: 'done' as const, webhookEventId: claim.row.id, outcome };
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider event processing error';
      await this.repository.recordFailure(eventData, message).catch((recordError: unknown) => {
        this.logger.error(
          `Could not record failed provider event "${eventData.provider_code}/${eventData.provider_event_id}": ${String(recordError)}`,
        );
      });
      throw error;
    }

    if (
      result.kind === 'done' &&
      result.outcome.kind === 'applied' &&
      result.outcome.outboxEventId !== null
    ) {
      const outboxEventId = result.outcome.outboxEventId;
      void Promise.resolve()
        .then(() => this.outboxService.dispatchById(outboxEventId))
        .catch((error: unknown) => {
          this.logger.warn(
            `Immediate outbox delivery of ${outboxEventId.toString()} failed (the worker will retry): ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
    return result;
  }
}
