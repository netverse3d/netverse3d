import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

@Injectable()
export class PaymentAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Parameters<PrismaService['payment_attempts']['create']>[0]['data']) {
    return this.prisma.payment_attempts.create({ data });
  }

  async nextOrderNumber(): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval(pg_get_serial_sequence('payment_attempts', 'order_number'))::bigint AS value`;
    const row = rows[0];
    if (!row) throw new Error('Failed to allocate payment attempt order number');
    return BigInt(row.value);
  }

  findByProviderPaymentId(providerCode: string, providerPaymentId: string) {
    return this.prisma.payment_attempts.findFirst({
      where: { provider_code: providerCode, provider_payment_id: providerPaymentId },
      include: { payment_intents: true },
    });
  }

  findByProviderOrderId(providerCode: string, providerOrderId: string) {
    return this.prisma.payment_attempts.findFirst({
      where: { provider_code: providerCode, provider_order_id: providerOrderId },
      include: { payment_intents: true },
      orderBy: { created_at: 'desc' },
    });
  }

  findByIdForTenant(tenantId: string, id: string) {
    return this.prisma.payment_attempts.findFirst({
      where: { id, tenant_id: tenantId },
      include: { payment_intents: true },
    });
  }

  async claimForReconciliation(input: {
    providerCodes: string[];
    limit: number;
    minAgeSeconds: number;
    spacingSeconds: number;
    maxAgeSeconds: number;
  }) {
    if (input.providerCodes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE payment_attempts
      SET last_reconciled_at = now(), reconcile_count = reconcile_count + 1
      WHERE id IN (
        SELECT id FROM payment_attempts
        WHERE status IN ('pending', 'requires_action', 'processing')
          AND provider_code = ANY(${input.providerCodes})
          AND started_at < now() - make_interval(secs => ${input.minAgeSeconds})
          AND started_at > now() - make_interval(secs => ${input.maxAgeSeconds})
          AND (last_reconciled_at IS NULL OR last_reconciled_at < now() - make_interval(secs => ${input.spacingSeconds}))
        ORDER BY last_reconciled_at ASC NULLS FIRST, started_at ASC
        LIMIT ${input.limit}
        FOR NO KEY UPDATE SKIP LOCKED
      )
      RETURNING id`;
    return this.findClaimed(rows);
  }

  async claimForRefresh(id: string, minIntervalSeconds: number) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE payment_attempts
      SET last_reconciled_at = now(), reconcile_count = reconcile_count + 1
      WHERE id = ${id}::uuid
        AND status IN ('pending', 'requires_action', 'processing')
        AND (last_reconciled_at IS NULL OR last_reconciled_at < now() - make_interval(secs => ${minIntervalSeconds}))
      RETURNING id`;
    const [attempt] = await this.findClaimed(rows);
    return attempt ?? null;
  }

  async claimExpired(input: {
    providerCodes: string[];
    graceMinutes: number;
    spacingSeconds: number;
    limit: number;
  }) {
    if (input.providerCodes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE payment_attempts
      SET last_reconciled_at = now(), reconcile_count = reconcile_count + 1
      WHERE id IN (
        SELECT id FROM payment_attempts
        WHERE status IN ('pending', 'requires_action', 'processing')
          AND provider_code = ANY(${input.providerCodes})
          AND expires_at IS NOT NULL
          AND expires_at < now() - make_interval(mins => ${input.graceMinutes})
          AND (last_reconciled_at IS NULL OR last_reconciled_at < now() - make_interval(secs => ${input.spacingSeconds}))
        ORDER BY expires_at ASC
        LIMIT ${input.limit}
        FOR NO KEY UPDATE SKIP LOCKED
      )
      RETURNING id`;
    return this.findClaimed(rows);
  }

  findById(id: string, db: PrismaDb = this.prisma) {
    return db.payment_attempts.findUnique({ where: { id } });
  }

  async hasNewerAttempt(
    attempt: { payment_intent_id: string; order_number: bigint },
    db: PrismaDb = this.prisma,
  ) {
    const newer = await db.payment_attempts.findFirst({
      where: {
        payment_intent_id: attempt.payment_intent_id,
        order_number: { gt: attempt.order_number },
      },
      select: { id: true },
    });
    return newer !== null;
  }

  update(
    id: string,
    data: Parameters<PrismaService['payment_attempts']['update']>[0]['data'],
    db: PrismaDb = this.prisma,
  ) {
    return db.payment_attempts.update({
      where: { id },
      data,
      include: { payment_intents: true },
    });
  }

  private async findClaimed(rows: Array<{ id: string }>) {
    if (rows.length === 0) return [];
    return this.prisma.payment_attempts.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: { payment_intents: true },
    });
  }
}
