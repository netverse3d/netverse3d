import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { ColumnSort } from '@app/common/pagination/to-column-sort';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class TenantApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Parameters<PrismaService['tenant_api_keys']['create']>[0]['data']) {
    return this.prisma.tenant_api_keys.create({ data });
  }

  findPageByTenant(tenantId: string, orderBy: ColumnSort, skip: number, take: number) {
    const where = { tenant_id: tenantId };
    return this.prisma.$transaction([
      this.prisma.tenant_api_keys.findMany({
        where,
        orderBy: orderBy as Prisma.tenant_api_keysOrderByWithRelationInput,
        skip,
        take,
      }),
      this.prisma.tenant_api_keys.count({ where }),
    ]);
  }
}
