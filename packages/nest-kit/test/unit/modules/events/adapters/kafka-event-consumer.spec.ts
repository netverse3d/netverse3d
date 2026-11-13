import {
  DeadLetter,
  EventSubscription,
  KafkaEventConsumer,
  MessageHandler,
  ProcessedEvents,
  ReceivedMessage,
} from '../../../../../src/modules/events/adapters/kafka-event-consumer';
import { InvalidEventError } from '../../../../../src/modules/outbox/domain/event-contracts';

class MemoryProcessedEvents implements ProcessedEvents {
  readonly ids = new Set<string>();

  has(eventId: string): Promise<boolean> {
    return Promise.resolve(this.ids.has(eventId));
  }

  mark(eventId: string): Promise<void> {
    this.ids.add(eventId);
    return Promise.resolve();
  }
}

const message = (overrides: Partial<ReceivedMessage> = {}): ReceivedMessage => ({
  topic: 'netverse.identity.events.v1',
  key: 'platform',
  value: Buffer.from('{"n":1}'),
  eventId: 'event-1',
  ...overrides,
});

function subject() {
  let deliver: MessageHandler = () => Promise.resolve();
  const subscription = { connected: true, stopped: false };
  const deadLetters: DeadLetter[] = [];
  const processed = new MemoryProcessedEvents();
  const consumer = new KafkaEventConsumer(
    (handler) => {
      deliver = handler;
      const handle: EventSubscription = {
        isConnected: () => subscription.connected,
        stop: () => {
          subscription.stopped = true;
          return Promise.resolve();
        },
      };
      return Promise.resolve(handle);
    },
    (letter) => {
      deadLetters.push(letter);
      return Promise.resolve();
    },
    processed,
  );
  return {
    consumer,
    deliver: (input: ReceivedMessage) => deliver(input),
    deadLetters,
    processed,
    subscription,
  };
}

function counting() {
  const calls = { count: 0 };
  const handler = () => {
    calls.count += 1;
    return Promise.resolve();
  };
  return { calls, handler };
}

describe('bộ nghe sự kiện từ Kafka', () => {
  it('đưa nội dung thông điệp cho bên xử lý rồi ghi nhớ mã sự kiện', async () => {
    const { consumer, deliver, processed } = subject();
    const handled: string[] = [];
    await consumer.start((payload) => {
      handled.push(payload.toString());
      return Promise.resolve();
    });
    await deliver(message());
    expect(handled).toEqual(['{"n":1}']);
    expect(processed.ids.has('event-1')).toBe(true);
  });

  it('sự kiện đã xử lý được gửi lại thì bỏ qua, không xử lý lần hai', async () => {
    const { consumer, deliver } = subject();
    const { calls, handler } = counting();
    await consumer.start(handler);
    await deliver(message());
    await deliver(message());
    expect(calls.count).toBe(1);
  });

  it('sự kiện hỏng vào topic thư chết kèm lý do, và không chặn sự kiện sau', async () => {
    const { consumer, deliver, deadLetters, processed } = subject();
    await consumer.start((payload) =>
      payload.toString() === 'broken'
        ? Promise.reject(new InvalidEventError('missing tenant'))
        : Promise.resolve(),
    );
    await deliver(message({ value: Buffer.from('broken'), eventId: 'event-bad' }));
    await deliver(message({ eventId: 'event-good' }));
    expect(deadLetters).toEqual([
      {
        topic: 'netverse.identity.events.v1.dlq',
        key: 'platform',
        value: Buffer.from('broken'),
        eventId: 'event-bad',
        reason: 'missing tenant',
      },
    ]);
    expect(processed.ids.has('event-bad')).toBe(true);
    expect(processed.ids.has('event-good')).toBe(true);
  });

  it('lỗi hạ tầng lúc xử lý được ném ra để thông điệp được giao lại, và chưa ghi nhớ mã', async () => {
    const { consumer, deliver, processed, deadLetters } = subject();
    await consumer.start(() => Promise.reject(new Error('database is down')));
    await expect(deliver(message())).rejects.toThrow('database is down');
    expect(processed.ids.size).toBe(0);
    expect(deadLetters).toHaveLength(0);
  });

  it('thông điệp không có nội dung bị bỏ qua', async () => {
    const { consumer, deliver } = subject();
    const { calls, handler } = counting();
    await consumer.start(handler);
    await deliver(message({ value: null }));
    expect(calls.count).toBe(0);
  });

  it('thông điệp không có mã sự kiện vẫn được xử lý ở mỗi lần giao', async () => {
    const { consumer, deliver } = subject();
    const { calls, handler } = counting();
    await consumer.start(handler);
    await deliver(message({ eventId: null }));
    await deliver(message({ eventId: null }));
    expect(calls.count).toBe(2);
  });

  it('báo khoẻ theo kết nối, và chưa khởi động thì chưa khoẻ', async () => {
    const { consumer, subscription } = subject();
    expect(consumer.isHealthy()).toBe(false);
    await consumer.start(() => Promise.resolve());
    expect(consumer.isHealthy()).toBe(true);
    subscription.connected = false;
    expect(consumer.isHealthy()).toBe(false);
  });

  it('dừng thì ngắt đăng ký', async () => {
    const { consumer, subscription } = subject();
    await consumer.start(() => Promise.resolve());
    await consumer.stop();
    expect(subscription.stopped).toBe(true);
    expect(consumer.isHealthy()).toBe(false);
  });
});
