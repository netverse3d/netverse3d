import { Injectable } from '@nestjs/common';
import { Notification, NotificationDelivery, Prisma } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DeliveryChannelName } from '../domain/channels';

export type NotificationWithDeliveries = Notification & { deliveries: NotificationDelivery[] };

export type NotificationSourceName = 'API' | 'EVENT' | 'SERVICE';

export interface NewDelivery {
  channel: DeliveryChannelName;
  destination: string | null;
}

export interface NewNotification {
  tenantId: string;
  source: NotificationSourceName;
  idempotencyKey: string | null;
  requestHash: Uint8Array<ArrayBuffer>;
  eventType: string;
  locale: string;
  variables: Record<string, unknown>;
  recipientSubject: string | null;
  recipientEmail: string | null;
  expiresAt: Date | null;
  deliveries: NewDelivery[];
}

export function isIdempotencyConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewNotification): Promise<NotificationWithDeliveries> {
    const { deliveries, variables, ...notification } = data;
    return this.prisma.notification.create({
      data: {
        ...notification,
        variables: variables as Prisma.InputJsonObject,
        deliveries: {
          create: deliveries.map((delivery) => ({
            ...delivery,
            tenantId: data.tenantId,
            eventType: data.eventType,
          })),
        },
      },
      include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    });
  }

  countApiEmailsSince(tenantId: string, since: Date): Promise<number> {
    return this.prisma.notificationDelivery.count({
      where: {
        tenantId,
        channel: 'EMAIL',
        destination: { not: null },
        status: { in: ['PENDING', 'PROCESSING', 'SENT'] },
        createdAt: { gte: since },
        notification: { source: 'API' },
      },
    });
  }

  findByKey(
    tenantId: string,
    source: NotificationSourceName,
    idempotencyKey: string,
  ): Promise<NotificationWithDeliveries | null> {
    return this.prisma.notification.findUnique({
      where: { tenantId_source_idempotencyKey: { tenantId, source, idempotencyKey } },
      include: { deliveries: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
