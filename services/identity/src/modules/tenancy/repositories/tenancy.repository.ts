import { Injectable } from '@nestjs/common';
import { Membership, Prisma, Principal, Role, Tenant } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type TenantRow = Tenant;
export type RoleRow = Role;
export type MemberRow = Membership & { principal: Principal; roles: { role: Role }[] };
export type TenancyTransaction = Prisma.TransactionClient;

const memberInclude = { principal: true, roles: { include: { role: true } } } as const;

@Injectable()
export class TenancyRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (transaction: TenancyTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  createTenant(data: { slug: string; name: string }): Promise<TenantRow> {
    return this.prisma.tenant.create({ data });
  }

  findTenant(id: string): Promise<TenantRow | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  findTenantPage(skip: number, take: number): Promise<[TenantRow[], number]> {
    return this.prisma.$transaction([
      this.prisma.tenant.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.tenant.count(),
    ]);
  }

  updateTenant(id: string, data: { name?: string; status?: Tenant['status'] }): Promise<TenantRow> {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  listRoles(tenantId: string): Promise<RoleRow[]> {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  upsertRole(tenantId: string, name: string, permissions: string[]): Promise<RoleRow> {
    return this.prisma.role.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: { tenantId, name, permissions },
      update: { permissions },
    });
  }

  async deleteRole(tenantId: string, name: string): Promise<number> {
    const { count } = await this.prisma.role.deleteMany({ where: { tenantId, name } });
    return count;
  }

  findRolesByName(tenantId: string, names: string[]): Promise<RoleRow[]> {
    return this.prisma.role.findMany({ where: { tenantId, name: { in: names } } });
  }

  findPrincipalByEmail(email: string): Promise<Principal | null> {
    return this.prisma.principal.findUnique({ where: { email } });
  }

  findMemberPage(tenantId: string, skip: number, take: number): Promise<[MemberRow[], number]> {
    const where: Prisma.MembershipWhereInput = { tenantId };
    return this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        skip,
        take,
        include: memberInclude,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.membership.count({ where }),
    ]);
  }

  findMember(tenantId: string, principalId: string): Promise<MemberRow | null> {
    return this.prisma.membership.findUnique({
      where: { principalId_tenantId: { principalId, tenantId } },
      include: memberInclude,
    });
  }

  async saveMember(
    tenantId: string,
    principalId: string,
    roleIds: string[],
    transaction: TenancyTransaction,
  ): Promise<void> {
    const membership = await transaction.membership.upsert({
      where: { principalId_tenantId: { principalId, tenantId } },
      create: { principalId, tenantId },
      update: { status: 'ACTIVE' },
    });
    await transaction.membershipRole.deleteMany({ where: { membershipId: membership.id } });
    await transaction.membershipRole.createMany({
      data: roleIds.map((roleId) => ({ membershipId: membership.id, roleId })),
    });
  }

  async revokeMember(
    tenantId: string,
    principalId: string,
    transaction: TenancyTransaction,
  ): Promise<number> {
    const { count } = await transaction.membership.updateMany({
      where: { tenantId, principalId, status: 'ACTIVE' },
      data: { status: 'REVOKED' },
    });
    return count;
  }

  async revokeTenantSessions(
    tenantId: string,
    principalId: string,
    transaction: TenancyTransaction,
  ): Promise<void> {
    await transaction.session.updateMany({
      where: { tenantId, principalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setPrincipalStatus(
    principalId: string,
    status: Principal['status'],
    transaction: TenancyTransaction,
  ): Promise<Principal> {
    return transaction.principal.update({
      where: { id: principalId },
      data: { status, ...(status === 'SUSPENDED' ? { tokenVersion: { increment: 1 } } : {}) },
    });
  }

  async revokeAllSessions(principalId: string, transaction: TenancyTransaction): Promise<void> {
    await transaction.session.updateMany({
      where: { principalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  findPrincipal(id: string): Promise<Principal | null> {
    return this.prisma.principal.findUnique({ where: { id } });
  }
}
