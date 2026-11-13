import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { ApiPagedEnvelope } from '@netverse/nest-kit';
import { TENANT_ADMIN_ROLE } from '@netverse/nest-kit';
import { DeliveryLogEntryDto, DeliveryQueryDto } from '../dto/delivery.dto';
import { DeliveryLogService } from '../services/delivery-log.service';

@ApiTags('deliveries')
@Roles(TENANT_ADMIN_ROLE)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveryLogService) {}

  @Get()
  @ApiOperation({ summary: 'List the delivery log of the tenant' })
  @ApiPagedEnvelope(DeliveryLogEntryDto)
  list(
    @Query() query: DeliveryQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<DeliveryLogEntryDto>> {
    return this.deliveries.list(query, actor);
  }
}
