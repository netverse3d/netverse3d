import { EventEnvelope } from '../domain/event-envelope';

export abstract class EventPublisher {
  abstract publish(event: EventEnvelope): Promise<void>;
}
