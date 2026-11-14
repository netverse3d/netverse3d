import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { ColumnSort } from '@app/common/pagination/to-column-sort';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

@Injectable()
export class TenantWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Parameters<PrismaService['tenant_webhook_endpoints']['create']>[0]['data']) {
    return this.prisma.tenant_webhook_endpoints.create({ data });
  }

  findPageByTenant(tenantId: string, orderBy: ColumnSort, skip: number, take: number) {
    const where = { tenant_id: tenantId };
    return this.prisma.$transaction([
      this.prisma.tenant_webhook_endpoints.findMany({
        where,
        orderBy: orderBy as Prisma.tenant_webhook_endpointsOrderByWithRelationInput,
        skip,
        take,
      }),
      this.prisma.tenant_webhook_endpoints.count({ where }),
    ]);
  }

  findByTenantAndUrl(tenantId: string, url: string) {
    return this.prisma.tenant_webhook_endpoints.findFirst({ where: { tenant_id: tenantId, url } });
  }

  findByIdForTenant(tenantId: string, id: string) {
    return this.prisma.tenant_webhook_endpoints.findFirst({ where: { id, tenant_id: tenantId } });
  }

  update(
    id: string,
    data: Pick<
      Prisma.tenant_webhook_endpointsUpdateInput,
      | 'url'
      | 'subscribed_events'
      | 'status'
      | 'secret_ciphertext'
      | 'secret_iv'
      | 'secret_tag'
      | 'secret_key_version'
    >,
  ) {
    return this.prisma.tenant_webhook_endpoints.update({ where: { id }, data });
  }

  findActiveSubscribers(tenantId: string, eventType: string, db: PrismaDb = this.prisma) {
    return db.tenant_webhook_endpoints.findMany({
      where: {
        tenant_id: tenantId,
        status: 'active',
        subscribed_events: { has: eventType },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  markDeliveryResult(id: string, ok: boolean) {
    return this.prisma.tenant_webhook_endpoints.update({
      where: { id },
      data: ok ? { last_success_at: new Date() } : { last_failure_at: new Date() },
    });
  }
}
