import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentTenant,
  CurrentTenantPayload,
} from '@app/common/decorators/current-tenant.decorator';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromResult } from '@app/modules/audit/audit-resource';
import { ApiKeyAuth } from '@app/modules/auth/decorators/api-key-auth.decorator';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerResponseDto } from '../dto/customer-response.dto';
import { CustomerService } from '../services/customer.service';

@ApiTags('Customers')
@ApiKeyAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Post()
  @Audit({ action: 'customer.create', resourceType: 'customer', resourceId: resourceIdFromResult })
  @ApiOperation({ summary: 'Resolve or create customer' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiEnvelope(CustomerResponseDto, HttpStatus.CREATED)
  resolveOrCreate(@CurrentTenant() tenant: CurrentTenantPayload, @Body() dto: CreateCustomerDto) {
    return this.service.resolveOrCreate(tenant.tenantId, dto);
  }
}
