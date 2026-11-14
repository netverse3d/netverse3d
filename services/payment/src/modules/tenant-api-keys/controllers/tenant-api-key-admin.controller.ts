import { Body, Controller, Get, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@app/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import { ApiEnvelope, ApiPagedEnvelope } from '@app/common/swagger/api-envelope.decorators';
import { Audit } from '@app/modules/audit/audit.decorator';
import { resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { CreateTenantApiKeyDto } from '../dto/create-tenant-api-key.dto';
import {
  CreatedTenantApiKeyResponseDto,
  TenantApiKeyResponseDto,
} from '../dto/tenant-api-key-response.dto';
import { TenantApiKeyService } from '../services/tenant-api-key.service';

@ApiTags('Tenant API Keys')
@Roles('platform_admin')
@Controller('internal/tenants/:tenantId/api-keys')
export class TenantApiKeyAdminController {
  constructor(private readonly service: TenantApiKeyService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys of a tenant' })
  @ApiPagedEnvelope(TenantApiKeyResponseDto)
  list(@Param('tenantId') tenantId: string, @Query() query: PaginationQueryDto) {
    return this.service.listByTenant(tenantId, query);
  }

  @Post()
  @Audit({
    action: 'tenant_api_key.create',
    resourceType: 'tenant_api_key',
    resourceId: resourceIdFromResult,
  })
  @ApiOperation({ summary: 'Create tenant API key; the raw key is returned once' })
  @ApiBody({ type: CreateTenantApiKeyDto })
  @ApiEnvelope(CreatedTenantApiKeyResponseDto, HttpStatus.CREATED)
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateTenantApiKeyDto) {
    return this.service.create(tenantId, dto);
  }
}
