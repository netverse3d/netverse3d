import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/infrastructure/prisma/client';
import { ColumnSort } from '@app/common/pagination/to-column-sort';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';

@Injectable()
export class ProviderAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.provider_accountsUncheckedCreateInput) {
    return this.prisma.provider_accounts.create({ data });
  }

  findById(id: string) {
    return this.prisma.provider_accounts.findUnique({ where: { id } });
  }

  findByIdForTenant(tenantId: string, id: string) {
    return this.prisma.provider_accounts.findFirst({ where: { id, tenant_id: tenantId } });
  }

  findPageByTenant(tenantId: string, orderBy: ColumnSort | undefined, skip: number, take: number) {
    const where = { tenant_id: tenantId };
    return this.prisma.$transaction([
      this.prisma.provider_accounts.findMany({
        where,
        orderBy: (orderBy as Prisma.provider_accountsOrderByWithRelationInput) ?? [
          { provider_code: 'asc' },
          { created_at: 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.provider_accounts.count({ where }),
    ]);
  }

  async findActiveProviderCodes(tenantId: string) {
    const rows = await this.prisma.provider_accounts.findMany({
      where: { tenant_id: tenantId, status: 'active' },
      select: { provider_code: true },
      distinct: ['provider_code'],
    });
    return rows.map((row) => row.provider_code);
  }

  findActiveByTenantAndCode(tenantId: string, providerCode: string) {
    return this.prisma.provider_accounts.findFirst({
      where: { tenant_id: tenantId, provider_code: providerCode, status: 'active' },
      orderBy: { created_at: 'desc' },
    });
  }

  findByExternalRef(providerCode: string, externalAccountRef: string) {
    return this.prisma.provider_accounts.findUnique({
      where: {
        provider_code_external_account_ref: {
          provider_code: providerCode,
          external_account_ref: externalAccountRef,
        },
      },
    });
  }

  update(
    id: string,
    data: Pick<
      Prisma.provider_accountsUncheckedUpdateInput,
      'status' | 'config_json' | 'account_label'
    >,
  ) {
    return this.prisma.provider_accounts.update({ where: { id }, data });
  }

  updateCredentials(
    id: string,
    data: Pick<
      Prisma.provider_accountsUncheckedUpdateInput,
      | 'credentials_json'
      | 'credentials_ciphertext'
      | 'credentials_iv'
      | 'credentials_tag'
      | 'credentials_key_version'
    >,
  ) {
    return this.prisma.provider_accounts.update({ where: { id }, data });
  }
}
