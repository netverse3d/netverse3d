import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { PLATFORM_ADMIN_ROLE } from '../domain/platform-roles';
import {
  AddMemberDto,
  CreateTenantDto,
  MemberDto,
  RoleDto,
  RoleListDto,
  SetMemberRolesDto,
  TenantDto,
  UpdateTenantDto,
  UpsertRoleDto,
} from '../dto/tenancy.dto';
import { TenancyService } from '../services/tenancy.service';

const tenantIdParam = ({ params }: AuditResourceInput) => params.id;
const principalIdParam = ({ params }: AuditResourceInput) => params.principalId;
const createdTenantId = ({ result }: AuditResourceInput) => (result as TenantDto | undefined)?.id;

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenancy: TenancyService) {}

  @Post()
  @Roles(PLATFORM_ADMIN_ROLE)
  @Audit({ action: 'tenant.create', resourceType: 'tenant', resourceId: createdTenantId })
  @ApiOperation({ summary: 'Create a tenant' })
  @ApiEnvelope(TenantDto, HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto): Promise<TenantDto> {
    return this.tenancy.createTenant(dto);
  }

  @Get()
  @Roles(PLATFORM_ADMIN_ROLE)
  @ApiOperation({ summary: 'List tenants' })
  @ApiPagedEnvelope(TenantDto)
  list(@Query() query: PaginationQueryDto): Promise<PageResponseDto<TenantDto>> {
    return this.tenancy.listTenants(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tenant' })
  @ApiEnvelope(TenantDto)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<TenantDto> {
    return this.tenancy.getTenant(id, actor);
  }

  @Patch(':id')
  @Roles(PLATFORM_ADMIN_ROLE)
  @Audit({ action: 'tenant.update', resourceType: 'tenant', resourceId: tenantIdParam })
  @ApiOperation({ summary: 'Rename or suspend a tenant' })
  @ApiEnvelope(TenantDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto): Promise<TenantDto> {
    return this.tenancy.updateTenant(id, dto);
  }

  @Get(':id/roles')
  @ApiOperation({ summary: 'List roles of a tenant' })
  @ApiEnvelope(RoleListDto)
  listRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<RoleListDto> {
    return this.tenancy.listRoles(id, actor);
  }

  @Put(':id/roles')
  @Audit({ action: 'role.upsert', resourceType: 'tenant', resourceId: tenantIdParam })
  @ApiOperation({ summary: 'Create a role or replace its permissions' })
  @ApiEnvelope(RoleDto)
  upsertRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRoleDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleDto> {
    return this.tenancy.upsertRole(id, dto, actor);
  }

  @Delete(':id/roles/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'role.delete', resourceType: 'tenant', resourceId: tenantIdParam })
  @ApiOperation({ summary: 'Delete a role' })
  @ApiNoContentResponse()
  deleteRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('name') name: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.tenancy.deleteRole(id, name, actor);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List members of a tenant' })
  @ApiPagedEnvelope(MemberDto)
  listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<MemberDto>> {
    return this.tenancy.listMembers(id, query, actor);
  }

  @Post(':id/members')
  @Audit({ action: 'membership.add', resourceType: 'tenant', resourceId: tenantIdParam })
  @ApiOperation({ summary: 'Add an existing account to a tenant' })
  @ApiEnvelope(MemberDto, HttpStatus.CREATED)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentActor() actor: Actor,
  ): Promise<MemberDto> {
    return this.tenancy.addMember(id, dto, actor);
  }

  @Put(':id/members/:principalId/roles')
  @Audit({
    action: 'membership.set_roles',
    resourceType: 'principal',
    resourceId: principalIdParam,
  })
  @ApiOperation({ summary: 'Replace the roles of a member' })
  @ApiEnvelope(MemberDto)
  setMemberRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('principalId', ParseUUIDPipe) principalId: string,
    @Body() dto: SetMemberRolesDto,
    @CurrentActor() actor: Actor,
  ): Promise<MemberDto> {
    return this.tenancy.setMemberRoles(id, principalId, dto.roles, actor);
  }

  @Delete(':id/members/:principalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'membership.remove', resourceType: 'principal', resourceId: principalIdParam })
  @ApiOperation({ summary: 'Remove a member and end their sessions in this tenant' })
  @ApiNoContentResponse()
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('principalId', ParseUUIDPipe) principalId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.tenancy.removeMember(id, principalId, actor);
  }
}
