import { Injectable } from '@nestjs/common';
import {
  ExternalIdentity,
  Membership,
  Prisma,
  Principal,
  Role,
} from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type PrincipalRow = Principal;
export type ExternalIdentityRow = ExternalIdentity;
export type DbTransaction = Prisma.TransactionClient;
export type MembershipWithRoles = Membership & {
  roles: { role: Role }[];
  tenant: { status: string };
};

export interface NewPrincipal {
  email: string | null;
  emailVerifiedAt?: Date | null;
  passwordHash?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isPlatformAdmin?: boolean;
}

export interface NewExternalIdentity {
  principalId: string;
  provider: ExternalIdentity['provider'];
  providerSubject: string;
  email: string | null;
}

@Injectable()
export class PrincipalRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (transaction: DbTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findById(id: string): Promise<PrincipalRow | null> {
    return this.prisma.principal.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<PrincipalRow | null> {
    return this.prisma.principal.findUnique({ where: { email } });
  }

  countPlatformAdmins(): Promise<number> {
    return this.prisma.principal.count({ where: { isPlatformAdmin: true } });
  }

  create(data: NewPrincipal, transaction: DbTransaction): Promise<PrincipalRow> {
    return transaction.principal.create({ data });
  }

  update(
    id: string,
    data: Prisma.PrincipalUncheckedUpdateInput,
    transaction?: DbTransaction,
  ): Promise<PrincipalRow> {
    return (transaction ?? this.prisma).principal.update({ where: { id }, data });
  }

  registerFailedLogin(
    id: string,
    failedLogins: number,
    lockedUntil: Date | null,
  ): Promise<PrincipalRow> {
    return this.prisma.principal.update({ where: { id }, data: { failedLogins, lockedUntil } });
  }

  resetFailedLogins(id: string): Promise<PrincipalRow> {
    return this.prisma.principal.update({
      where: { id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  }

  findExternal(
    provider: ExternalIdentity['provider'],
    providerSubject: string,
  ): Promise<(ExternalIdentityRow & { principal: PrincipalRow }) | null> {
    return this.prisma.externalIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
      include: { principal: true },
    });
  }

  listExternal(principalId: string): Promise<ExternalIdentityRow[]> {
    return this.prisma.externalIdentity.findMany({
      where: { principalId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createExternal(data: NewExternalIdentity, transaction?: DbTransaction): Promise<void> {
    await (transaction ?? this.prisma).externalIdentity.create({ data });
  }

  async deleteExternal(
    principalId: string,
    provider: ExternalIdentity['provider'],
  ): Promise<number> {
    const { count } = await this.prisma.externalIdentity.deleteMany({
      where: { principalId, provider },
    });
    return count;
  }

  findMembership(principalId: string, tenantId: string): Promise<MembershipWithRoles | null> {
    return this.prisma.membership.findUnique({
      where: { principalId_tenantId: { principalId, tenantId } },
      include: { roles: { include: { role: true } }, tenant: { select: { status: true } } },
    });
  }

  listMemberships(
    principalId: string,
  ): Promise<
    (Membership & { tenant: { id: string; slug: string; name: string }; roles: { role: Role }[] })[]
  > {
    return this.prisma.membership.findMany({
      where: { principalId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      include: {
        tenant: { select: { id: true, slug: true, name: true } },
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
