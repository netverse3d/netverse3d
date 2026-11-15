import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam, resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { TenantResponseDto } from '../dto/tenant-response.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { TenantService } from '../services/tenant.service';

@ApiTags('Tenant Admin')
@Roles('platform_admin')
@Controller('internal/tenants')
export class TenantAdminController {
  constructor(private readonly service: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'List tenants' })
  @ApiPagedEnvelope(TenantResponseDto)
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @Audit({ action: 'tenant.create', resourceType: 'tenant', resourceId: resourceIdFromResult })
  @ApiOperation({ summary: 'Create tenant' })
  @ApiBody({ type: CreateTenantDto })
  @ApiEnvelope(TenantResponseDto, HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Audit({ action: 'tenant.update', resourceType: 'tenant', resourceId: resourceIdFromParam('id') })
  @ApiOperation({ summary: 'Update tenant' })
  @ApiBody({ type: UpdateTenantDto })
  @ApiEnvelope(TenantResponseDto)
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(id, dto);
  }
}
