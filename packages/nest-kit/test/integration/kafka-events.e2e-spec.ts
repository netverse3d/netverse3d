import { randomUUID } from 'node:crypto';
import {
  connectProducer,
  deadLetterSinkOf,
  ensureTopics,
  KafkaSettings,
  subscribeToTopics,
} from '../../src/infrastructure/kafka/kafka-client';
import {
  deadLetterTopicOf,
  EventSubscription,
  KafkaEventConsumer,
  ProcessedEvents,
  ReceivedMessage,
} from '../../src/modules/events/adapters/kafka-event-consumer';
import {
  EventProducer,
  KafkaEventPublisher,
} from '../../src/modules/outbox/adapters/kafka-event-publisher';
import { InvalidEventError } from '../../src/modules/outbox/domain/event-contracts';
import { EventEnvelope } from '../../src/modules/outbox/domain/event-envelope';
import { topicFor } from '../../src/modules/outbox/domain/event-topic';

const BROKERS = (process.env.KAFKA_TEST_BROKERS ?? '').split(',').filter(Boolean);
const WAIT_MS = 30_000;

class MemoryProcessedEvents implements ProcessedEvents {
  private readonly ids = new Set<string>();

  has(eventId: string): Promise<boolean> {
    return Promise.resolve(this.ids.has(eventId));
  }

  mark(eventId: string): Promise<void> {
    this.ids.add(eventId);
    return Promise.resolve();
  }
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('condition was not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('sự kiện qua Kafka thật', () => {
  const settings: KafkaSettings = { brokers: BROKERS, clientId: 'nest-kit-integration' };
  const stoppables: Array<{ stop(): Promise<void> }> = [];
  const producers: EventProducer[] = [];

  beforeAll(() => {
    if (BROKERS.length === 0) {
      throw new Error('KAFKA_TEST_BROKERS must point at a running Kafka for integration tests');
    }
  });

  afterEach(async () => {
    await Promise.all(stoppables.splice(0).map((item) => item.stop()));
    await Promise.all(producers.splice(0).map((producer) => producer.disconnect()));
  });

  function eventFrom(source: string, tenantId: string | null, n: number): EventEnvelope {
    return {
      id: randomUUID(),
      type: 'probe.happened',
      source,
      occurredAt: new Date().toISOString(),
      version: 1,
      data: { tenantId, n },
    };
  }

  async function scenario() {
    const source = `it-${randomUUID().slice(0, 8)}`;
    const topic = topicFor(source);
    await ensureTopics(settings, [topic, deadLetterTopicOf(topic)]);
    const publisher = new KafkaEventPublisher(async () => {
      const producer = await connectProducer(settings);
      producers.push(producer);
      return producer;
    });
    return { source, topic, publisher };
  }

  async function listen(topic: string, handler: (payload: Buffer) => Promise<void>) {
    const deadLetterProducer = await connectProducer(settings);
    producers.push(deadLetterProducer);
    const consumer = new KafkaEventConsumer(
      (deliver) =>
        subscribeToTopics({ ...settings, groupId: `it-${randomUUID()}`, topics: [topic] }, deliver),
      deadLetterSinkOf(deadLetterProducer),
      new MemoryProcessedEvents(),
    );
    await consumer.start(handler);
    stoppables.push(consumer);
    return consumer;
  }

  async function collect(topic: string): Promise<{ messages: ReceivedMessage[] }> {
    const messages: ReceivedMessage[] = [];
    const subscription: EventSubscription = await subscribeToTopics(
      { ...settings, groupId: `it-${randomUUID()}`, topics: [topic] },
      (message) => {
        messages.push(message);
        return Promise.resolve();
      },
    );
    stoppables.push(subscription);
    return { messages };
  }

  it('sự kiện phát ra tới được bên nghe nguyên vẹn, đúng topic và khoá', async () => {
    const { source, topic, publisher } = await scenario();
    const event = eventFrom(source, 'tenant-a', 1);
    const raw = await collect(topic);
    const received: EventEnvelope[] = [];
    const consumer = await listen(topic, (payload) => {
      received.push(JSON.parse(payload.toString()) as EventEnvelope);
      return Promise.resolve();
    });

    await publisher.publish(event);
    await until(() => received.length === 1 && raw.messages.length === 1);

    expect(received[0]).toEqual(event);
    expect(raw.messages[0]).toMatchObject({ topic, key: 'tenant-a', eventId: event.id });
    expect(consumer.isHealthy()).toBe(true);
  });

  it('các sự kiện của cùng một tiệm tới theo đúng thứ tự phát', async () => {
    const { source, topic, publisher } = await scenario();
    const order: number[] = [];
    await listen(topic, (payload) => {
      order.push((JSON.parse(payload.toString()) as EventEnvelope).data.n as number);
      return Promise.resolve();
    });
    for (const n of [1, 2, 3, 4, 5]) {
      await publisher.publish(eventFrom(source, 'tenant-a', n));
    }
    await until(() => order.length === 5);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it('sự kiện hỏng vào topic thư chết kèm nội dung gốc, sự kiện sau vẫn được xử lý', async () => {
    const { source, topic, publisher } = await scenario();
    const deadLetters = await collect(deadLetterTopicOf(topic));
    const handled: number[] = [];
    await listen(topic, (payload) => {
      const { n } = (JSON.parse(payload.toString()) as EventEnvelope).data;
      if (n === 1) {
        return Promise.reject(new InvalidEventError('unknown tenant'));
      }
      handled.push(n as number);
      return Promise.resolve();
    });
    const poison = eventFrom(source, null, 1);
    await publisher.publish(poison);
    await publisher.publish(eventFrom(source, null, 2));

    await until(() => handled.length === 1 && deadLetters.messages.length === 1);

    expect(handled).toEqual([2]);
    expect(deadLetters.messages[0]?.key).toBe('platform');
    expect(JSON.parse(deadLetters.messages[0]?.value?.toString() ?? '{}')).toEqual(poison);
  });

  it('bên xử lý lỗi tạm thời thì sự kiện được giao lại cho tới lúc xử lý xong', async () => {
    const { source, topic, publisher } = await scenario();
    let attempts = 0;
    const done: string[] = [];
    await listen(topic, (payload) => {
      attempts += 1;
      if (attempts < 3) {
        return Promise.reject(new Error('database is down'));
      }
      done.push((JSON.parse(payload.toString()) as EventEnvelope).id);
      return Promise.resolve();
    });
    const event = eventFrom(source, 'tenant-a', 1);
    await publisher.publish(event);

    await until(() => done.length === 1);

    expect(done).toEqual([event.id]);
    expect(attempts).toBe(3);
  });
});
