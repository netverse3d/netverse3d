import { OnModuleDestroy } from '@nestjs/common';
import { EventEnvelope } from '../domain/event-envelope';
import { scopeKeyOf, topicFor } from '../domain/event-topic';
import { EventPublisher } from '../ports/event-publisher';

export const EVENT_ID_HEADER = 'event-id';
export const EVENT_TYPE_HEADER = 'event-type';

const BROKER_ANSWER_TIMEOUT_MS = 15_000;

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

function withinTime<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Kafka did not answer within ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

export class KafkaEventPublisher extends EventPublisher implements OnModuleDestroy {
  private producer: Promise<EventProducer> | null = null;

  constructor(
    private readonly connect: ProducerConnector,
    private readonly timeoutMs: number = BROKER_ANSWER_TIMEOUT_MS,
  ) {
    super();
  }

  async publish(event: EventEnvelope): Promise<void> {
    const attempt = this.connected();
    try {
      const producer = await withinTime(attempt, this.timeoutMs);
      await withinTime(
        producer.send({
          topic: topicFor(event.source),
          key: scopeKeyOf(event),
          value: JSON.stringify(event),
          headers: { [EVENT_ID_HEADER]: event.id, [EVENT_TYPE_HEADER]: event.type },
        }),
        this.timeoutMs,
      );
    } catch (error) {
      this.discard(attempt);
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
    this.producer ??= this.connect();
    return this.producer;
  }

  private discard(attempt: Promise<EventProducer>): void {
    if (this.producer === attempt) {
      this.producer = null;
    }
    attempt.then((producer) => producer.disconnect()).catch(() => undefined);
  }
}
