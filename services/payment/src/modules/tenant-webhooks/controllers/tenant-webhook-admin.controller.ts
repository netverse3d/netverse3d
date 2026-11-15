import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam, resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { CreateTenantWebhookDto, UpdateTenantWebhookDto } from '../dto/create-tenant-webhook.dto';
import {
  TenantWebhookResponseDto,
  TenantWebhookSecretResponseDto,
} from '../dto/tenant-webhook-response.dto';
import { TenantWebhookService } from '../services/tenant-webhook.service';

@ApiTags('Tenant Webhooks')
@Roles('platform_admin')
@Controller('internal/tenants/:tenantId/webhooks')
export class TenantWebhookAdminController {
  constructor(private readonly service: TenantWebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant webhook endpoints without their secrets' })
  @ApiPagedEnvelope(TenantWebhookResponseDto)
  list(@Param('tenantId', ParseUUIDPipe) tenantId: string, @Query() query: PaginationQueryDto) {
    return this.service.list(tenantId, query);
  }

  @Post()
  @Audit({
    action: 'tenant_webhook.create',
    resourceType: 'tenant_webhook',
    resourceId: resourceIdFromResult,
  })
  @ApiOperation({ summary: 'Create tenant webhook endpoint; the raw secret is returned once' })
  @ApiBody({ type: CreateTenantWebhookDto })
  @ApiEnvelope(TenantWebhookSecretResponseDto, HttpStatus.CREATED)
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateTenantWebhookDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':endpointId')
  @Audit({
    action: 'tenant_webhook.update',
    resourceType: 'tenant_webhook',
    resourceId: resourceIdFromParam('endpointId'),
  })
  @ApiOperation({ summary: 'Update the URL, subscribed events or status of an endpoint' })
  @ApiBody({ type: UpdateTenantWebhookDto })
  @ApiEnvelope(TenantWebhookResponseDto)
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('endpointId', ParseUUIDPipe) endpointId: string,
    @Body() dto: UpdateTenantWebhookDto,
  ) {
    return this.service.update(tenantId, endpointId, dto);
  }

  @Post(':endpointId/rotate-secret')
  @HttpCode(HttpStatus.CREATED)
  @Audit({
    action: 'tenant_webhook.rotate_secret',
    resourceType: 'tenant_webhook',
    resourceId: resourceIdFromParam('endpointId'),
  })
  @ApiOperation({ summary: 'Rotate the webhook signing secret; the raw secret is returned once' })
  @ApiEnvelope(TenantWebhookSecretResponseDto, HttpStatus.CREATED)
  rotateSecret(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('endpointId', ParseUUIDPipe) endpointId: string,
  ) {
    return this.service.rotateSecret(tenantId, endpointId);
  }
}
