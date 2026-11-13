import { InvalidEventError } from '../../outbox/domain/event-contracts';
import { EventConsumer, EventPayloadHandler } from '../ports/event-consumer';

const DEAD_LETTER_SUFFIX = '.dlq';

export interface ReceivedMessage {
  topic: string;
  key: string | null;
  value: Buffer | null;
  eventId: string | null;
}

export interface DeadLetter {
  topic: string;
  key: string | null;
  value: Buffer;
  reason: string;
}

export interface EventSubscription {
  isConnected(): boolean;
  stop(): Promise<void>;
}

export interface ProcessedEvents {
  has(eventId: string): Promise<boolean>;
  mark(eventId: string): Promise<void>;
}

export type MessageHandler = (message: ReceivedMessage) => Promise<void>;
export type SubscriptionConnector = (handler: MessageHandler) => Promise<EventSubscription>;
export type DeadLetterSink = (letter: DeadLetter) => Promise<void>;

export function deadLetterTopicOf(topic: string): string {
  return `${topic}${DEAD_LETTER_SUFFIX}`;
}

export class KafkaEventConsumer extends EventConsumer {
  private subscription: EventSubscription | null = null;

  constructor(
    private readonly subscribe: SubscriptionConnector,
    private readonly sendToDeadLetters: DeadLetterSink,
    private readonly processed: ProcessedEvents,
  ) {
    super();
  }

  async start(handler: EventPayloadHandler): Promise<void> {
    this.subscription = await this.subscribe((message) => this.receive(message, handler));
  }

  async stop(): Promise<void> {
    const subscription = this.subscription;
    this.subscription = null;
    await subscription?.stop();
  }

  isHealthy(): boolean {
    return this.subscription?.isConnected() ?? false;
  }

  private async receive(message: ReceivedMessage, handler: EventPayloadHandler): Promise<void> {
    const { value, eventId } = message;
    if (!value || (eventId && (await this.processed.has(eventId)))) {
      return;
    }
    try {
      await handler(value);
    } catch (error) {
      if (!(error instanceof InvalidEventError)) {
        throw error;
      }
      await this.sendToDeadLetters({
        topic: deadLetterTopicOf(message.topic),
        key: message.key,
        value,
        reason: error.message,
      });
    }
    if (eventId) {
      await this.processed.mark(eventId);
    }
  }
}
