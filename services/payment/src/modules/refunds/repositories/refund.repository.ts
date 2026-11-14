import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';
import { RESERVING_REFUND_STATUSES } from '../state/refund-state-machine';

@Injectable()
export class RefundRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.refundsUncheckedCreateInput, db: PrismaDb = this.prisma) {
    return db.refunds.create({ data });
  }

  findById(id: string, db: PrismaDb = this.prisma) {
    return db.refunds.findUnique({ where: { id } });
  }

  findByPublicId(tenantId: string, publicId: string) {
    return this.prisma.refunds.findFirst({
      where: { tenant_id: tenantId, public_id: publicId },
      include: {
        payment_intents: { select: { public_id: true, status: true, total_minor: true } },
      },
    });
  }

  listForIntent(paymentIntentId: string) {
    return this.prisma.refunds.findMany({
      where: { payment_intent_id: paymentIntentId },
      orderBy: { created_at: 'asc' },
    });
  }

  async sumReserved(paymentIntentId: string, db: PrismaDb) {
    const result = await db.refunds.aggregate({
      where: { payment_intent_id: paymentIntentId, status: { in: [...RESERVING_REFUND_STATUSES] } },
      _sum: { amount_minor: true },
    });
    return result._sum.amount_minor ?? 0n;
  }

  async sumSucceeded(paymentIntentId: string, db: PrismaDb) {
    const result = await db.refunds.aggregate({
      where: { payment_intent_id: paymentIntentId, status: 'succeeded' },
      _sum: { amount_minor: true },
    });
    return result._sum.amount_minor ?? 0n;
  }

  async lockForUpdate(id: string, db: PrismaDb) {
    await db.$queryRaw`SELECT id FROM refunds WHERE id = ${id}::uuid FOR NO KEY UPDATE`;
  }

  update(id: string, data: Prisma.refundsUncheckedUpdateInput, db: PrismaDb) {
    return db.refunds.update({ where: { id }, data });
  }

  async claimForReconciliation(input: {
    providerCodes: string[];
    limit: number;
    spacingSeconds: number;
  }) {
    if (input.providerCodes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE refunds
      SET last_reconciled_at = now(), reconcile_count = reconcile_count + 1
      WHERE id IN (
        SELECT r.id FROM refunds r
        JOIN payment_attempts a ON a.id = r.payment_attempt_id
        WHERE r.status IN ('pending', 'processing')
          AND a.provider_code = ANY(${input.providerCodes})
          AND (r.last_reconciled_at IS NULL OR r.last_reconciled_at < now() - make_interval(secs => ${input.spacingSeconds}))
        ORDER BY r.last_reconciled_at ASC NULLS FIRST
        LIMIT ${input.limit}
        FOR NO KEY UPDATE OF r SKIP LOCKED
      )
      RETURNING id`;
    if (rows.length === 0) return [];
    return this.prisma.refunds.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: { payment_intents: true, payment_attempts: true },
    });
  }
}
