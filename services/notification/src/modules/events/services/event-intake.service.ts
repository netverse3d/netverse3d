import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { parseInboundEvent } from '../domain/inbound-event';
import { EventConsumer, InvalidEventError } from '@netverse/nest-kit';

const SERVER_ERROR_STATUS = 500;

@Injectable()
export class EventIntakeService implements OnApplicationBootstrap, OnModuleDestroy {
  constructor(
    private readonly consumer: EventConsumer,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): Promise<void> {
    return this.consumer.start((payload) => this.handle(payload));
  }

  onModuleDestroy(): Promise<void> {
    return this.consumer.stop();
  }

  async handle(payload: Buffer): Promise<void> {
    const event = parseInboundEvent(payload);
    try {
      await this.notifications.accept({
        tenantId: event.tenantId,
        source: 'EVENT',
        idempotencyKey: event.id,
        eventType: event.eventType,
        locale: event.locale,
        channels: event.channels,
        recipient: event.recipient,
        variables: event.variables,
      });
    } catch (error) {
      if (error instanceof AppException && error.definition.httpStatus < SERVER_ERROR_STATUS) {
        throw new InvalidEventError(`event rejected: ${error.definition.code}`);
      }
      throw error;
    }
  }
}
