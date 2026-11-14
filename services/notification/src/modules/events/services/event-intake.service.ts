import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { AppException, EventConsumer, EventContracts, InvalidEventError } from '@netverse/nest-kit';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { listenedSources, reactionTo, readEnvelope } from '../domain/event-reactions';

const SERVER_ERROR_STATUS = 500;

@Injectable()
export class EventIntakeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly contracts = new Map(
    listenedSources().map((source) => [
      source,
      EventContracts.forService(source, { required: true }),
    ]),
  );

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
    const event = readEnvelope(payload);
    const contract = this.contracts.get(event.source);
    if (!contract) {
      throw new InvalidEventError(`events from ${event.source} are not listened to`);
    }
    contract.assertValid(event);
    const order = reactionTo(event);
    if (!order) {
      return;
    }
    try {
      await this.notifications.accept({
        tenantId: order.scope,
        source: 'EVENT',
        idempotencyKey: event.id,
        eventType: order.eventType,
        recipient: order.recipient,
        variables: order.variables,
      });
    } catch (error) {
      if (error instanceof AppException && error.definition.httpStatus < SERVER_ERROR_STATUS) {
        throw new InvalidEventError(`event rejected: ${error.definition.code}`);
      }
      throw error;
    }
  }
}
