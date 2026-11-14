import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'os';
import { randomBytes } from 'crypto';
import { AppConfig } from '@app/config/app-config';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { TenantWebhookRepository } from '@app/modules/tenant-webhooks/repositories/tenant-webhook.repository';
import { PaymentOutboxDeliveryRepository } from '../repositories/payment-outbox-delivery.repository';
import { PaymentOutboxRepository } from '../repositories/payment-outbox.repository';
import { OutboundWebhookService, nextRetryDelayMs } from './outbound-webhook.service';

const BATCH_SIZE = 50;

type ClaimedDelivery = Awaited<ReturnType<PaymentOutboxDeliveryRepository['claimDue']>>[number];

@Injectable()
export class OutboxDeliveryService {
  private readonly logger = new Logger(OutboxDeliveryService.name);
  readonly workerId = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`.slice(0, 80);

  constructor(
    private readonly outboxRepository: PaymentOutboxRepository,
    private readonly deliveryRepository: PaymentOutboxDeliveryRepository,
    private readonly tenantWebhookRepository: TenantWebhookRepository,
    private readonly sender: OutboundWebhookService,
    private readonly transactions: TransactionRunner,
    private readonly config: AppConfig,
  ) {}

  async runOnce(limit = BATCH_SIZE) {
    const fannedOut = await this.fanOut(limit);
    const results = await this.deliverDue(limit);
    return { fannedOut, ...summarize(results) };
  }

  async dispatchEvent(outboxEventId: bigint) {
    await this.fanOut(1, outboxEventId);
    return summarize(await this.deliverDue(BATCH_SIZE, outboxEventId));
  }

  async fanOut(limit: number, outboxEventId?: bigint) {
    return this.transactions.run(async (tx) => {
      const events = await this.outboxRepository.lockUnfanned(limit, tx, outboxEventId);
      for (const event of events) {
        const endpoints = await this.tenantWebhookRepository.findActiveSubscribers(
          event.tenant_id,
          event.event_type,
          tx,
        );
        if (endpoints.length > 0) {
          await this.deliveryRepository.createMany(
            endpoints.map((endpoint) => ({
              outbox_event_id: event.id,
              endpoint_id: endpoint.id,
              tenant_id: event.tenant_id,
            })),
            tx,
          );
        }
        await this.outboxRepository.markFannedOut(event.id, endpoints.length > 0, tx);
      }
      return events.length;
    });
  }

  async deliverDue(limit: number, outboxEventId?: bigint) {
    const claimed = await this.deliveryRepository.claimDue(this.workerId, limit, outboxEventId);
    const results: Array<{ deliveryId: string; outcome: string }> = [];
    for (const delivery of claimed) {
      results.push({ deliveryId: delivery.id, outcome: await this.deliverOne(delivery) });
    }
    return results;
  }

  private async deliverOne(delivery: ClaimedDelivery) {
    const result = await this.sender.send(delivery.endpoint, delivery.outbox_event);
    const attemptCount = delivery.attempt_count + 1;
    let finalOutcome: 'delivered' | 'retry' | 'dead' = 'delivered';

    if (result.outcome === 'delivered') {
      await this.deliveryRepository.finish(delivery.id, this.workerId, {
        status: 'delivered',
        attempt_count: attemptCount,
        last_http_status: result.httpStatus,
        last_error: null,
        delivered_at: new Date(),
      });
    } else {
      const exhausted =
        result.outcome === 'dead' || attemptCount >= this.config.payment.outboxMaxAttempts;
      finalOutcome = exhausted ? 'dead' : 'retry';
      await this.deliveryRepository.finish(delivery.id, this.workerId, {
        status: exhausted ? 'dead' : 'pending',
        attempt_count: attemptCount,
        last_http_status: result.httpStatus,
        last_error: result.error,
        available_at: exhausted ? undefined : new Date(Date.now() + nextRetryDelayMs(attemptCount)),
      });
      if (exhausted) {
        this.logger.warn(
          `Outbox delivery ${delivery.id} (event ${delivery.outbox_event_id}) -> dead after ${attemptCount} attempts: ${result.error}`,
        );
      }
    }

    await this.tenantWebhookRepository
      .markDeliveryResult(delivery.endpoint_id, result.outcome === 'delivered')
      .catch(() => undefined);
    await this.rollUpEvent(
      delivery.outbox_event_id,
      result.outcome === 'delivered' ? null : result.error,
    );
    return finalOutcome;
  }

  private async rollUpEvent(outboxEventId: bigint, error: string | null) {
    const counts = await this.deliveryRepository.countByStatus(outboxEventId);
    const count = (status: string) => counts.find((row) => row.status === status)?._count._all ?? 0;
    const total = counts.reduce((sum, row) => sum + row._count._all, 0);
    const status =
      count('delivered') === total ? 'delivered' : count('dead') > 0 ? 'failed' : 'pending';
    await this.outboxRepository.rollUp(outboxEventId, status, error ? { error } : null);
  }
}

function summarize(results: Array<{ outcome: string }>) {
  return {
    attempted: results.length,
    delivered: results.filter((r) => r.outcome === 'delivered').length,
    retrying: results.filter((r) => r.outcome === 'retry').length,
    dead: results.filter((r) => r.outcome === 'dead').length,
  };
}
