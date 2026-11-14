import { Body, Controller, Headers, HttpStatus, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { ApiEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import { SCOPE_ADMIN_ROLES } from '@netverse/nest-kit';
import { ROLE_NOTIFICATION_SEND } from '../domain/limits';
import { AcceptedNotificationDto, SendNotificationDto } from '../dto/notification.dto';
import { NotificationsService } from '../services/notifications.service';

const acceptedNotificationId = ({ result }: AuditResourceInput) =>
  (result as AcceptedNotificationDto | undefined)?.id;

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @Roles(ROLE_NOTIFICATION_SEND, ...SCOPE_ADMIN_ROLES)
  @Audit({
    action: 'notification.send',
    resourceType: 'notification',
    resourceId: acceptedNotificationId,
  })
  @ApiOperation({ summary: 'Accept a notification and queue its deliveries' })
  @ApiHeader({ name: 'idempotency-key', required: false })
  @ApiEnvelope(AcceptedNotificationDto, HttpStatus.CREATED)
  send(
    @Body() dto: SendNotificationDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentActor() actor: Actor,
  ): Promise<AcceptedNotificationDto> {
    return this.notifications.send(dto, idempotencyKey, actor);
  }
}
