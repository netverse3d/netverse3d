import type { KafkaJS } from '@confluentinc/kafka-javascript';
import type {
  DeadLetterSink,
  EventSubscription,
  MessageHandler,
} from '../../modules/events/adapters/kafka-event-consumer';
import {
  EVENT_ID_HEADER,
  EventProducer,
  ProducedMessage,
} from '../../modules/outbox/adapters/kafka-event-publisher';

const DEAD_LETTER_REASON_HEADER = 'dead-letter-reason';

export interface KafkaSettings {
  brokers: string[];
  clientId: string;
}

export async function createKafka(settings: KafkaSettings): Promise<KafkaJS.Kafka> {
  const { KafkaJS: client } = await import('@confluentinc/kafka-javascript');
  return new client.Kafka({
    kafkaJS: {
      brokers: settings.brokers,
      clientId: settings.clientId,
      logLevel: client.logLevel.ERROR,
    },
  });
}

export async function connectProducer(settings: KafkaSettings): Promise<EventProducer> {
  const kafka = await createKafka(settings);
  const producer = kafka.producer({ kafkaJS: { idempotent: true, acks: -1 } });
  await producer.connect();
  return {
    async send(message: ProducedMessage): Promise<void> {
      await producer.send({
        topic: message.topic,
        messages: [{ key: message.key, value: message.value, headers: message.headers }],
      });
    },
    disconnect: () => producer.disconnect(),
  };
}

export interface SubscriptionSettings extends KafkaSettings {
  groupId: string;
  topics: string[];
}

function headerText(headers: KafkaJS.IHeaders | undefined, name: string): string | null {
  const raw = headers?.[name];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first === undefined ? null : first.toString();
}

export async function ensureTopics(settings: KafkaSettings, topics: string[]): Promise<void> {
  const kafka = await createKafka(settings);
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));
    if (missing.length > 0) {
      await admin.createTopics({ topics: missing.map((topic) => ({ topic })) });
    }
  } finally {
    await admin.disconnect();
  }
}

export async function subscribeToTopics(
  settings: SubscriptionSettings,
  handler: MessageHandler,
): Promise<EventSubscription> {
  await ensureTopics(settings, settings.topics);
  const kafka = await createKafka(settings);
  const consumer = kafka.consumer({
    kafkaJS: { groupId: settings.groupId, fromBeginning: true },
  });
  await consumer.connect();
  let connected = true;
  try {
    await consumer.subscribe({ topics: settings.topics });
    await consumer.run({
      eachMessage: ({ topic, message }) =>
        handler({
          topic,
          key: message.key?.toString() ?? null,
          value: message.value,
          eventId: headerText(message.headers, EVENT_ID_HEADER),
        }),
    });
  } catch (error) {
    await consumer.disconnect().catch(() => undefined);
    throw error;
  }
  return {
    isConnected: () => connected,
    async stop(): Promise<void> {
      connected = false;
      await consumer.disconnect();
    },
  };
}

export function deadLetterSinkOf(producer: EventProducer): DeadLetterSink {
  return (letter) =>
    producer.send({
      topic: letter.topic,
      key: letter.key ?? '',
      value: letter.value.toString(),
      headers: {
        [DEAD_LETTER_REASON_HEADER]: letter.reason,
        ...(letter.eventId ? { [EVENT_ID_HEADER]: letter.eventId } : {}),
      },
    });
}
