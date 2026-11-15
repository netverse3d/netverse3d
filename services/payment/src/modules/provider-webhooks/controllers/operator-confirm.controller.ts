import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/common/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam } from '@app/modules/audit/audit-resource';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { PaymentIntentResponseDto } from '@app/modules/payments/dto/payment-response.dto';
import { ConfirmTransferDto } from '../dto/confirm-transfer.dto';
import { OperatorConfirmService } from '../services/operator-confirm.service';

@ApiTags('Payments')
@ApiKeyAuth()
@Controller('payment-attempts')
export class OperatorConfirmController {
  constructor(private readonly service: OperatorConfirmService) {}

  @Post(':attemptId/confirm-transfer')
  @HttpCode(200)
  @Audit({
    action: 'payment_attempt.confirm_transfer',
    resourceType: 'payment_attempt',
    resourceId: resourceIdFromParam('attemptId'),
  })
  @ApiOperation({
    summary:
      'Operator confirms a received bank transfer (operatorConfirm providers such as VietQR); returns the intent',
  })
  @ApiBody({ type: ConfirmTransferDto })
  @ApiEnvelope(PaymentIntentResponseDto)
  confirmTransfer(
    @CurrentTenant() tenant: CurrentTenantPayload,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: ConfirmTransferDto,
  ) {
    return this.service.confirmTransfer(tenant.tenantId, attemptId, dto);
  }
}
