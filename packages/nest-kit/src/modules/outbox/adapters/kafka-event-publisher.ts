import { OnModuleDestroy } from '@nestjs/common';
import { EventEnvelope } from '../domain/event-envelope';
import { scopeKeyOf, topicFor } from '../domain/event-topic';
import { EventPublisher } from '../ports/event-publisher';

export const EVENT_ID_HEADER = 'event-id';
export const EVENT_TYPE_HEADER = 'event-type';

export interface ProducedMessage {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

export interface EventProducer {
  send(message: ProducedMessage): Promise<void>;
  disconnect(): Promise<void>;
}

export type ProducerConnector = () => Promise<EventProducer>;

export class KafkaEventPublisher extends EventPublisher implements OnModuleDestroy {
  private producer: Promise<EventProducer> | null = null;

  constructor(private readonly connect: ProducerConnector) {
    super();
  }

  async publish(event: EventEnvelope): Promise<void> {
    const producer = await this.connected();
    try {
      await producer.send({
        topic: topicFor(event.source),
        key: scopeKeyOf(event),
        value: JSON.stringify(event),
        headers: { [EVENT_ID_HEADER]: event.id, [EVENT_TYPE_HEADER]: event.type },
      });
    } catch (error) {
      this.producer = null;
      await producer.disconnect().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const pending = this.producer;
    this.producer = null;
    if (pending) {
      const producer = await pending.catch(() => null);
      await producer?.disconnect();
    }
  }

  private connected(): Promise<EventProducer> {
    if (!this.producer) {
      const attempt = this.connect();
      attempt.catch(() => {
        if (this.producer === attempt) {
          this.producer = null;
        }
      });
      this.producer = attempt;
    }
    return this.producer;
  }
}
