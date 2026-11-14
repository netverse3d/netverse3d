import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

export const DELIVERY_LOCK_TIMEOUT_SECONDS = 120;

@Injectable()
export class PaymentOutboxDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(rows: Prisma.payment_outbox_deliveriesCreateManyInput[], db: PrismaDb) {
    return db.payment_outbox_deliveries.createMany({ data: rows, skipDuplicates: true });
  }

  async claimDue(workerId: string, limit: number, outboxEventId?: bigint) {
    const eventFilter =
      outboxEventId === undefined
        ? Prisma.empty
        : Prisma.sql`AND outbox_event_id = ${outboxEventId}`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE payment_outbox_deliveries
      SET locked_at = now(), locked_by = ${workerId}, updated_at = now()
      WHERE id IN (
        SELECT id FROM payment_outbox_deliveries
        WHERE status = 'pending'
          AND available_at <= now()
          AND (locked_at IS NULL OR locked_at < now() - make_interval(secs => ${DELIVERY_LOCK_TIMEOUT_SECONDS}))
          ${eventFilter}
        ORDER BY available_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (rows.length === 0) return [];
    return this.prisma.payment_outbox_deliveries.findMany({
      where: { id: { in: rows.map((row) => row.id) }, locked_by: workerId },
      include: { outbox_event: true, endpoint: true },
    });
  }

  async finish(
    id: string,
    workerId: string,
    data: Prisma.payment_outbox_deliveriesUpdateManyMutationInput,
  ) {
    const result = await this.prisma.payment_outbox_deliveries.updateMany({
      where: { id, locked_by: workerId },
      data: { ...data, locked_at: null, locked_by: null },
    });
    return result.count === 1;
  }

  countByStatus(outboxEventId: bigint) {
    return this.prisma.payment_outbox_deliveries.groupBy({
      by: ['status'],
      where: { outbox_event_id: outboxEventId },
      _count: { _all: true },
    });
  }

  listDead(skip: number, take: number, tenantId?: string) {
    const where: Prisma.payment_outbox_deliveriesWhereInput = {
      status: 'dead',
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.payment_outbox_deliveries.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip,
        take,
        include: { endpoint: { select: { id: true, url: true, status: true } } },
      }),
      this.prisma.payment_outbox_deliveries.count({ where }),
    ]);
  }

  async requeueDead(id: string) {
    const result = await this.prisma.payment_outbox_deliveries.updateMany({
      where: { id, status: 'dead' },
      data: { status: 'pending', available_at: new Date(), locked_at: null, locked_by: null },
    });
    return result.count === 1;
  }
}
