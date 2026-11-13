import { Injectable } from '@nestjs/common';
import { Notification, NotificationDelivery, Prisma } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DeliveryStatusName } from '../../notifications/domain/channels';
import { MAX_DELIVERY_DETAIL_LENGTH } from '../../notifications/domain/limits';
import { OutboxRepository } from '@netverse/nest-kit';

export type DeliveryRow = NotificationDelivery;
export type ClaimedDelivery = NotificationDelivery & { notification: Notification };
export type DeliveryOrderBy = Prisma.NotificationDeliveryOrderByWithRelationInput;

export interface DeliveryOutcome {
  status: Extract<DeliveryStatusName, 'SENT' | 'SKIPPED' | 'DEAD'>;
  reason: string | null;
  detail: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  providerMessageId?: string | null;
}

export interface DeliveryFilter {
  status?: DeliveryStatusName;
  eventType?: string;
}

function truncateDetail(detail: string | null): string | null {
  return detail === null ? null : detail.slice(0, MAX_DELIVERY_DETAIL_LENGTH);
}

@Injectable()
export class DeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxRepository,
  ) {}

  async claimDue(limit: number, leaseMs: number): Promise<ClaimedDelivery[]> {
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH due AS (
        SELECT id
        FROM notification_deliveries
        WHERE (status = 'PENDING' AND next_attempt_at <= now())
           OR (status = 'PROCESSING' AND locked_until <= now())
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE notification_deliveries AS delivery
      SET status = 'PROCESSING',
          attempts = delivery.attempts + 1,
          locked_until = now() + make_interval(secs => ${leaseMs}::float8 / 1000),
          updated_at = now()
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.id
    `;
    if (claimed.length === 0) {
      return [];
    }
    return this.prisma.notificationDelivery.findMany({
      where: { id: { in: claimed.map((row) => row.id) } },
      include: { notification: true },
    });
  }

  async settle(delivery: ClaimedDelivery, outcome: DeliveryOutcome): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const { count } = await transaction.notificationDelivery.updateMany({
        where: { id: delivery.id, status: 'PROCESSING', attempts: delivery.attempts },
        data: {
          status: outcome.status,
          reason: outcome.reason,
          detail: truncateDetail(outcome.detail),
          templateId: outcome.templateId ?? null,
          templateVersion: outcome.templateVersion ?? null,
          providerMessageId: outcome.providerMessageId ?? null,
          lockedUntil: null,
          sentAt: outcome.status === 'SENT' ? new Date() : null,
        },
      });
      if (count === 0) {
        return;
      }
      await this.outbox.enqueue(
        {
          type: `notification.delivery.${outcome.status.toLowerCase()}`,
          aggregateId: delivery.id,
          tenantId: delivery.tenantId,
          payload: {
            deliveryId: delivery.id,
            notificationId: delivery.notificationId,
            eventType: delivery.eventType,
            channel: delivery.channel,
            status: outcome.status,
            reason: outcome.reason,
            attempts: delivery.attempts,
          },
        },
        transaction,
      );
    });
  }

  async scheduleRetry(
    delivery: ClaimedDelivery,
    nextAttemptAt: Date,
    reason: string,
    detail: string,
    countAttempt = true,
  ): Promise<void> {
    await this.prisma.notificationDelivery.updateMany({
      where: { id: delivery.id, status: 'PROCESSING', attempts: delivery.attempts },
      data: {
        status: 'PENDING',
        attempts: countAttempt ? undefined : { decrement: 1 },
        nextAttemptAt,
        reason,
        detail: truncateDetail(detail),
        lockedUntil: null,
      },
    });
  }

  findPage(
    tenantId: string,
    filter: DeliveryFilter,
    orderBy: DeliveryOrderBy,
    skip: number,
    take: number,
  ): Promise<[DeliveryRow[], number]> {
    const where: Prisma.NotificationDeliveryWhereInput = { tenantId, ...filter };
    return this.prisma.$transaction([
      this.prisma.notificationDelivery.findMany({ where, orderBy, skip, take }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
  }
}
