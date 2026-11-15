import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { PaymentIntentResponseDto } from '../dto/payment-response.dto';
import { PaymentQueryService } from '../services/payment-query.service';

@ApiTags('Payments Admin')
@Roles('platform_admin')
@Controller('internal/payments')
export class PaymentAdminController {
  constructor(private readonly queryService: PaymentQueryService) {}

  @Get(':tenantId/intents/:publicId')
  @ApiOperation({ summary: 'Get intent by tenant and public id' })
  @ApiEnvelope(PaymentIntentResponseDto)
  getIntent(@Param('tenantId') tenantId: string, @Param('publicId') publicId: string) {
    return this.queryService.getIntent(tenantId, publicId);
  }
}
