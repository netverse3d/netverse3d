import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { IdentityErrorCode } from '../../identity/identity-error-codes';
import { OutboxRepository } from '@netverse/nest-kit';
import { isPlatformAdmin, isPlatformOnlyRole, isTenantAdmin } from '../domain/platform-roles';
import {
  AddMemberDto,
  CreateTenantDto,
  MemberDto,
  RoleDto,
  RoleListDto,
  TenantDto,
  UpdateTenantDto,
  UpsertRoleDto,
} from '../dto/tenancy.dto';
import {
  MemberRow,
  RoleRow,
  TenancyRepository,
  TenancyTransaction,
  TenantRow,
} from '../repositories/tenancy.repository';

const toTenantDto = (row: TenantRow): TenantDto => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

const toRoleDto = (row: RoleRow): RoleDto => ({
  id: row.id,
  name: row.name,
  permissions: row.permissions,
});

const toMemberDto = (row: MemberRow): MemberDto => ({
  principalId: row.principalId,
  email: row.principal.email,
  displayName: row.principal.displayName,
  status: row.status,
  roles: row.roles.map(({ role }) => role.name),
});

@Injectable()
export class TenancyService {
  constructor(
    private readonly repository: TenancyRepository,
    private readonly outbox: OutboxRepository,
  ) {}

  async createTenant(dto: CreateTenantDto): Promise<TenantDto> {
    try {
      return toTenantDto(await this.repository.createTenant(dto));
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        throw new AppException(IdentityErrorCode.TENANT_SLUG_TAKEN);
      }
      throw error;
    }
  }

  async listTenants(query: PaginationQueryDto): Promise<PageResponseDto<TenantDto>> {
    const [rows, total] = await this.repository.findTenantPage(query.skip, query.take);
    return PageResponseDto.of(rows.map(toTenantDto), query, total);
  }

  async getTenant(id: string, actor: Actor): Promise<TenantDto> {
    this.assertCanManage(id, actor);
    return toTenantDto(await this.requireTenant(id));
  }

  async updateTenant(id: string, dto: UpdateTenantDto): Promise<TenantDto> {
    await this.requireTenant(id);
    return toTenantDto(await this.repository.updateTenant(id, dto));
  }

  async listRoles(tenantId: string, actor: Actor): Promise<RoleListDto> {
    this.assertCanManage(tenantId, actor);
    return { roles: (await this.repository.listRoles(tenantId)).map(toRoleDto) };
  }

  async upsertRole(tenantId: string, dto: UpsertRoleDto, actor: Actor): Promise<RoleDto> {
    this.assertCanManage(tenantId, actor);
    if (isPlatformOnlyRole(dto.name)) {
      throw new AppException(IdentityErrorCode.ROLE_NAME_RESERVED);
    }
    await this.requireTenant(tenantId);
    return toRoleDto(await this.repository.upsertRole(tenantId, dto.name, dto.permissions));
  }

  async deleteRole(tenantId: string, name: string, actor: Actor): Promise<void> {
    this.assertCanManage(tenantId, actor);
    if ((await this.repository.deleteRole(tenantId, name)) === 0) {
      throw new AppException(IdentityErrorCode.ROLE_NOT_FOUND);
    }
  }

  async listMembers(
    tenantId: string,
    query: PaginationQueryDto,
    actor: Actor,
  ): Promise<PageResponseDto<MemberDto>> {
    this.assertCanManage(tenantId, actor);
    const [rows, total] = await this.repository.findMemberPage(tenantId, query.skip, query.take);
    return PageResponseDto.of(rows.map(toMemberDto), query, total);
  }

  async addMember(tenantId: string, dto: AddMemberDto, actor: Actor): Promise<MemberDto> {
    this.assertCanManage(tenantId, actor);
    await this.requireTenant(tenantId);
    const principal = await this.repository.findPrincipalByEmail(dto.email.trim().toLowerCase());
    if (!principal) {
      throw new AppException(IdentityErrorCode.PRINCIPAL_NOT_FOUND);
    }
    return this.saveMember(tenantId, principal.id, dto.roles, 'membership.added');
  }

  async setMemberRoles(
    tenantId: string,
    principalId: string,
    roles: string[],
    actor: Actor,
  ): Promise<MemberDto> {
    this.assertCanManage(tenantId, actor);
    const existing = await this.repository.findMember(tenantId, principalId);
    if (!existing || existing.status !== 'ACTIVE') {
      throw new AppException(IdentityErrorCode.MEMBER_NOT_FOUND);
    }
    return this.saveMember(tenantId, principalId, roles, 'role.changed');
  }

  async removeMember(tenantId: string, principalId: string, actor: Actor): Promise<void> {
    this.assertCanManage(tenantId, actor);
    await this.repository.transaction(async (transaction) => {
      if ((await this.repository.revokeMember(tenantId, principalId, transaction)) === 0) {
        throw new AppException(IdentityErrorCode.MEMBER_NOT_FOUND);
      }
      await this.repository.revokeTenantSessions(tenantId, principalId, transaction);
      await this.emitMembership('membership.revoked', tenantId, principalId, [], transaction);
    });
  }

  async setPrincipalStatus(principalId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
    if (!(await this.repository.findPrincipal(principalId))) {
      throw new AppException(IdentityErrorCode.PRINCIPAL_NOT_FOUND);
    }
    await this.repository.transaction(async (transaction) => {
      const updated = await this.repository.setPrincipalStatus(principalId, status, transaction);
      if (status === 'SUSPENDED') {
        await this.repository.revokeAllSessions(principalId, transaction);
      }
      await this.outbox.enqueue(
        {
          type: status === 'SUSPENDED' ? 'user.deactivated' : 'user.reactivated',
          aggregateId: updated.id,
          tenantId: null,
          payload: { principalId: updated.id, status: updated.status },
        },
        transaction,
      );
    });
  }

  private async saveMember(
    tenantId: string,
    principalId: string,
    roleNames: string[],
    eventType: string,
  ): Promise<MemberDto> {
    const uniqueNames = [...new Set(roleNames)];
    const roles = await this.repository.findRolesByName(tenantId, uniqueNames);
    if (roles.length !== uniqueNames.length) {
      throw new AppException(IdentityErrorCode.ROLE_NOT_FOUND);
    }
    await this.repository.transaction(async (transaction) => {
      await this.repository.saveMember(
        tenantId,
        principalId,
        roles.map((role) => role.id),
        transaction,
      );
      await this.emitMembership(eventType, tenantId, principalId, uniqueNames, transaction);
    });
    return toMemberDto((await this.repository.findMember(tenantId, principalId)) as MemberRow);
  }

  private emitMembership(
    type: string,
    tenantId: string,
    principalId: string,
    roles: string[],
    transaction: TenancyTransaction,
  ): Promise<void> {
    return this.outbox.enqueue(
      { type, aggregateId: principalId, tenantId, payload: { principalId, tenantId, roles } },
      transaction,
    );
  }

  private assertCanManage(tenantId: string, actor: Actor): void {
    const ownAdmin = actor.tenantId === tenantId && isTenantAdmin(actor);
    if (!isPlatformAdmin(actor) && !ownAdmin) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
  }

  private async requireTenant(id: string): Promise<TenantRow> {
    const tenant = await this.repository.findTenant(id);
    if (!tenant) {
      throw new AppException(IdentityErrorCode.TENANT_NOT_FOUND);
    }
    return tenant;
  }
}
