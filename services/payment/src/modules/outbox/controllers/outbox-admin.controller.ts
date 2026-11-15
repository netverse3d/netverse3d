import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit } from '@netverse/nest-kit';
import { resourceIdFromParam } from '@app/modules/audit/audit-resource';
import {
  DeadDeliveryQueryDto,
  DeadDeliveryResponseDto,
  DispatchOutboxDto,
  OutboxDispatchResponseDto,
  RetryDeliveryResponseDto,
} from '../dto/outbox.dto';
import { OutboxService } from '../services/outbox.service';

@ApiTags('Outbox Admin')
@Roles('platform_admin')
@Controller('internal/outbox')
export class OutboxAdminController {
  constructor(private readonly service: OutboxService) {}

  @Post('dispatch')
  @Audit({ action: 'outbox.dispatch', resourceType: 'outbox' })
  @ApiOperation({ summary: 'Run one outbox worker cycle now (fan-out and deliver what is due)' })
  @ApiEnvelope(OutboxDispatchResponseDto, 201)
  dispatch(@Body() body?: DispatchOutboxDto) {
    return this.service.dispatchPending(body?.limit ?? 50);
  }

  @Get('deliveries/dead')
  @ApiOperation({ summary: 'List dead deliveries (retries exhausted or 4xx)' })
  @ApiPagedEnvelope(DeadDeliveryResponseDto)
  listDead(@Query() query: DeadDeliveryQueryDto) {
    return this.service.listDeadDeliveries(query);
  }

  @Post('deliveries/:id/retry')
  @Audit({
    action: 'outbox_delivery.retry',
    resourceType: 'outbox_delivery',
    resourceId: resourceIdFromParam('id'),
  })
  @ApiOperation({ summary: 'Manually retry a dead delivery (requeue it immediately)' })
  @ApiEnvelope(RetryDeliveryResponseDto, 201)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.retryDeadDelivery(id);
  }
}
