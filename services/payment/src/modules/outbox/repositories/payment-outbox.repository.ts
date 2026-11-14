import { Injectable } from '@nestjs/common';
import { outbox_delivery_status } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

@Injectable()
export class PaymentOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Parameters<PrismaService['payment_outbox_events']['create']>[0]['data'],
    db: PrismaDb = this.prisma,
  ) {
    return db.payment_outbox_events.create({ data });
  }

  findById(id: bigint) {
    return this.prisma.payment_outbox_events.findUnique({
      where: { id },
      include: { tenants: true },
    });
  }

  async lockUnfanned(limit: number, db: PrismaDb, outboxEventId?: bigint) {
    const rows =
      outboxEventId === undefined
        ? await db.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM payment_outbox_events
          WHERE fanned_out_at IS NULL AND delivery_status <> 'delivered'
          ORDER BY id ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED`
        : await db.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM payment_outbox_events
          WHERE id = ${outboxEventId} AND fanned_out_at IS NULL AND delivery_status <> 'delivered'
          FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return [];
    return db.payment_outbox_events.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      orderBy: { id: 'asc' },
    });
  }

  markFannedOut(id: bigint, hasDeliveries: boolean, db: PrismaDb) {
    const now = new Date();
    return db.payment_outbox_events.update({
      where: { id },
      data: hasDeliveries
        ? { fanned_out_at: now }
        : { fanned_out_at: now, delivery_status: 'delivered', processed_at: now },
    });
  }

  rollUp(id: bigint, status: outbox_delivery_status, failure: { error: string } | null) {
    return this.prisma.payment_outbox_events.update({
      where: { id },
      data: {
        delivery_status: status,
        processed_at: status === 'delivered' ? new Date() : undefined,
        ...(failure ? { fail_count: { increment: 1 }, last_error: failure.error } : {}),
      },
    });
  }
}
