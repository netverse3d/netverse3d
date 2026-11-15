import { Body, Controller, Get, Headers, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/common/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RefundResponseDto } from '../dto/refund-response.dto';
import { RefundService } from '../services/refund.service';

@ApiTags('Refunds')
@ApiKeyAuth()
@Controller()
export class RefundController {
  constructor(private readonly service: RefundService) {}

  @Post('payment-intents/:publicId/refunds')
  @Audit({ action: 'refund.create', resourceType: 'refund', resourceId: resourceIdFromResult })
  @ApiOperation({
    summary: 'Refund a paid intent in full or in part (idempotency-key is required)',
  })
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiBody({ type: CreateRefundDto })
  @ApiEnvelope(RefundResponseDto, HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: CurrentTenantPayload,
    @Param('publicId') publicId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.service.create(tenant, publicId, idempotencyKey, dto);
  }

  @Get('refunds/:publicId')
  @ApiOperation({ summary: 'Get a refund' })
  @ApiEnvelope(RefundResponseDto)
  findOne(@CurrentTenant() tenant: CurrentTenantPayload, @Param('publicId') publicId: string) {
    return this.service.findOne(tenant.tenantId, publicId);
  }
}
