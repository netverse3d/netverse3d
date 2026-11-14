import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { ColumnSort } from '@app/common/pagination/to-column-sort';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Parameters<PrismaService['tenants']['create']>[0]['data']) {
    return this.prisma.tenants.create({ data });
  }

  findPage(orderBy: ColumnSort, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.tenants.findMany({
        orderBy: orderBy as Prisma.tenantsOrderByWithRelationInput,
        skip,
        take,
      }),
      this.prisma.tenants.count(),
    ]);
  }

  findById(id: string) {
    return this.prisma.tenants.findUnique({ where: { id } });
  }

  findByCode(code: string) {
    return this.prisma.tenants.findUnique({ where: { code } });
  }

  update(id: string, data: Parameters<PrismaService['tenants']['update']>[0]['data']) {
    return this.prisma.tenants.update({ where: { id }, data });
  }
}
