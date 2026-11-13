import { Module } from '@nestjs/common';
import { KitConfig } from '../../config/kit-config';
import { connectProducer } from '../../infrastructure/kafka/kafka-client';
import { KafkaEventPublisher } from './adapters/kafka-event-publisher';
import { LogEventPublisher } from './adapters/log-event-publisher';
import { EventContracts } from './domain/event-contracts';
import { EventPublisher } from './ports/event-publisher';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxRelayJob } from './services/outbox-relay.job';

function createEventPublisher(config: KitConfig): EventPublisher {
  const { brokers } = config.events;
  return brokers.length > 0
    ? new KafkaEventPublisher(() => connectProducer({ brokers, clientId: config.service.name }))
    : new LogEventPublisher();
}

@Module({
  providers: [
    OutboxRepository,
    OutboxRelayJob,
    { provide: EventPublisher, useFactory: createEventPublisher, inject: [KitConfig] },
    {
      provide: EventContracts,
      useFactory: (config: KitConfig) =>
        EventContracts.forService(config.service.name, {
          required: config.service.environment === 'production',
        }),
      inject: [KitConfig],
    },
  ],
  exports: [OutboxRepository],
})
export class OutboxModule {}
