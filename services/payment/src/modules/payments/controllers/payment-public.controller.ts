import { Body, Controller, Get, Headers, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/modules/auth/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam, resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { CreatePaymentAttemptDto } from '../dto/create-payment-attempt.dto';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { PaymentAttemptResponseDto, PaymentIntentResponseDto } from '../dto/payment-response.dto';
import { PaymentAttemptService } from '../services/payment-attempt.service';
import { PaymentIntentService } from '../services/payment-intent.service';
import { PaymentQueryService } from '../services/payment-query.service';

@ApiTags('Payments')
@ApiKeyAuth()
@Controller('payment-intents')
export class PaymentPublicController {
  constructor(
    private readonly paymentIntentService: PaymentIntentService,
    private readonly paymentAttemptService: PaymentAttemptService,
    private readonly paymentQueryService: PaymentQueryService,
  ) {}

  @Post()
  @Audit({
    action: 'payment_intent.create',
    resourceType: 'payment_intent',
    resourceId: resourceIdFromResult,
  })
  @ApiOperation({ summary: 'Create payment intent' })
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiEnvelope(PaymentIntentResponseDto, HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: CurrentTenantPayload,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.paymentIntentService.create(tenant, idempotencyKey, dto);
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Get payment intent' })
  @ApiEnvelope(PaymentIntentResponseDto)
  findOne(@CurrentTenant() tenant: CurrentTenantPayload, @Param('publicId') publicId: string) {
    return this.paymentQueryService.getIntent(tenant.tenantId, publicId);
  }

  @Post(':publicId/attempts')
  @Audit({
    action: 'payment_attempt.create',
    resourceType: 'payment_intent',
    resourceId: resourceIdFromParam('publicId'),
  })
  @ApiOperation({ summary: 'Create payment attempt' })
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiBody({ type: CreatePaymentAttemptDto })
  @ApiEnvelope(PaymentAttemptResponseDto, HttpStatus.CREATED)
  createAttempt(
    @CurrentTenant() tenant: CurrentTenantPayload,
    @Param('publicId') publicId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePaymentAttemptDto,
  ) {
    return this.paymentAttemptService.create(tenant, publicId, idempotencyKey, dto);
  }
}
