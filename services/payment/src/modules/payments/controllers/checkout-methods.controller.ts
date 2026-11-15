import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/common/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@netverse/nest-kit';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { CheckoutMethodsResponseDto } from '../dto/payment-response.dto';
import { CheckoutMethodsService } from '../services/checkout-methods.service';

@ApiTags('Payments')
@ApiKeyAuth()
@Controller('checkout-methods')
export class CheckoutMethodsController {
  constructor(private readonly service: CheckoutMethodsService) {}

  @Get()
  @ApiOperation({
    summary: 'List usable payment methods: enabled providers the tenant has an active account for',
  })
  @ApiEnvelope(CheckoutMethodsResponseDto)
  async list(@CurrentTenant() tenant: CurrentTenantPayload) {
    return { methods: await this.service.list(tenant.tenantId) };
  }
}
