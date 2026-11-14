import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/common/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@app/common/swagger/api-envelope.decorators';
import { Audit } from '@app/modules/audit/audit.decorator';
import { resourceIdFromParam } from '@app/modules/audit/audit-resource';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { PaymentIntentResponseDto } from '@app/modules/payments/dto/payment-response.dto';
import { ReconciliationService } from '../services/reconciliation.service';

@ApiTags('Payments')
@ApiKeyAuth()
@Controller('payment-intents')
export class PaymentRefreshController {
  constructor(private readonly service: ReconciliationService) {}

  @Post(':publicId/refresh')
  @HttpCode(200)
  @Audit({
    action: 'payment_intent.refresh',
    resourceType: 'payment_intent',
    resourceId: resourceIdFromParam('publicId'),
  })
  @ApiOperation({
    summary:
      'Query the provider now for open attempts (rate limited per attempt) and return the intent',
  })
  @ApiEnvelope(PaymentIntentResponseDto)
  refresh(@CurrentTenant() tenant: CurrentTenantPayload, @Param('publicId') publicId: string) {
    return this.service.refreshIntent(tenant.tenantId, publicId);
  }
}
