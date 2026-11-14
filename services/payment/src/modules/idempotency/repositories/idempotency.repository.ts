import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(tenantId: string, scope: string, key: string) {
    return this.prisma.idempotency_records.findUnique({
      where: {
        tenant_id_scope_idempotency_key: { tenant_id: tenantId, scope, idempotency_key: key },
      },
    });
  }

  async tryInsert(data: Prisma.idempotency_recordsCreateManyInput) {
    const result = await this.prisma.idempotency_records.createMany({
      data: [data],
      skipDuplicates: true,
    });
    return result.count === 1;
  }

  async takeOverExpired(id: string, now: Date, lockedUntil: Date) {
    const result = await this.prisma.idempotency_records.updateMany({
      where: {
        id,
        processing_status: 'started',
        OR: [{ locked_until: null }, { locked_until: { lt: now } }],
      },
      data: { locked_until: lockedUntil },
    });
    return result.count === 1;
  }

  async finish(id: string, data: Prisma.idempotency_recordsUpdateManyMutationInput) {
    const result = await this.prisma.idempotency_records.updateMany({
      where: { id, processing_status: 'started' },
      data,
    });
    return result.count === 1;
  }

  releaseLease(id: string, now: Date) {
    return this.prisma.idempotency_records.updateMany({
      where: { id, processing_status: 'started' },
      data: { locked_until: now },
    });
  }
}
