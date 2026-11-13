import { Injectable } from '@nestjs/common';
import { BrandingEntry } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type BrandingRow = BrandingEntry;

@Injectable()
export class BrandingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string): Promise<BrandingRow[]> {
    return this.prisma.brandingEntry.findMany({ where: { tenantId }, orderBy: { key: 'asc' } });
  }

  upsert(tenantId: string, key: string, value: string): Promise<BrandingRow> {
    return this.prisma.brandingEntry.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value },
      update: { value },
    });
  }

  async delete(tenantId: string, key: string): Promise<boolean> {
    const { count } = await this.prisma.brandingEntry.deleteMany({ where: { tenantId, key } });
    return count > 0;
  }
}
