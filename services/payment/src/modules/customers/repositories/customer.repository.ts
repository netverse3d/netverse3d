import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByTenantAndRef(tenantId: string, customerRef: string) {
    return this.prisma.customers.findUnique({
      where: { tenant_id_customer_ref: { tenant_id: tenantId, customer_ref: customerRef } },
    });
  }

  create(data: Parameters<PrismaService['customers']['create']>[0]['data']) {
    return this.prisma.customers.create({ data });
  }
}
