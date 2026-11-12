import { Module } from '@nestjs/common';
import { LogEventPublisher } from './adapters/log-event-publisher';
import { EventPublisher } from './ports/event-publisher';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxRelayJob } from './services/outbox-relay.job';

@Module({
  providers: [
    OutboxRepository,
    OutboxRelayJob,
    { provide: EventPublisher, useClass: LogEventPublisher },
  ],
  exports: [OutboxRepository],
})
export class OutboxModule {}
