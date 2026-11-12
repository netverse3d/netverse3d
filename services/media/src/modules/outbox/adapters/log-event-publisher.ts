import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher, OutboundEvent } from '../ports/event-publisher';

@Injectable()
export class LogEventPublisher extends EventPublisher {
  private readonly logger = new Logger(LogEventPublisher.name);

  publish(event: OutboundEvent): Promise<void> {
    this.logger.log({ event }, 'event published');
    return Promise.resolve();
  }
}
