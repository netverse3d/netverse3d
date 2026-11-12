import { Injectable, Logger } from '@nestjs/common';
import { EventEnvelope } from '../domain/event-envelope';
import { EventPublisher } from '../ports/event-publisher';

@Injectable()
export class LogEventPublisher extends EventPublisher {
  private readonly logger = new Logger(LogEventPublisher.name);

  publish(event: EventEnvelope): Promise<void> {
    this.logger.log({ event }, 'event published');
    return Promise.resolve();
  }
}
