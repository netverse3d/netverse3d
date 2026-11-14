import {
  EventSubscription,
  KafkaEventConsumer,
  NoneEventConsumer,
  SubscriptionSettings,
} from '@netverse/nest-kit';
import { AppConfig } from '../../../../src/config/app-config';
import { parseEnv } from '../../../../src/config/env.schema';
import { createEventConsumer } from '../../../../src/modules/events/event-consumer.factory';

const BASE = {
  SERVICE_NAME: 'notification',
  DATABASE_URL: 'postgresql://localhost/unused',
  AUTH_JWKS_URL: 'http://localhost/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
  PUSH_PROVIDER: 'none',
};

const processed = { has: () => Promise.resolve(false), mark: () => Promise.resolve() };
const configOf = (overrides: Record<string, string>) =>
  new AppConfig(parseEnv({ ...BASE, ...overrides }));

describe('chọn bộ nghe sự kiện theo cấu hình', () => {
  it('mặc định không nghe gì và luôn báo khoẻ', () => {
    const consumer = createEventConsumer(configOf({}), processed);
    expect(consumer).toBeInstanceOf(NoneEventConsumer);
    expect(consumer.isHealthy()).toBe(true);
  });

  it('chọn kafka mà thiếu broker thì không khởi động', () => {
    expect(() => parseEnv({ ...BASE, EVENT_TRANSPORT: 'kafka' })).toThrow('KAFKA_BROKERS');
  });

  it('nghe topic của từng nguồn có phản ứng, bằng consumer group của riêng service', async () => {
    const subscriptions: SubscriptionSettings[] = [];
    const subscription: EventSubscription = {
      isConnected: () => true,
      stop: () => Promise.resolve(),
    };
    const consumer = createEventConsumer(
      configOf({ EVENT_TRANSPORT: 'kafka', KAFKA_BROKERS: 'kafka-a:9092,kafka-b:9092' }),
      processed,
      {
        subscribe: (settings: SubscriptionSettings) => {
          subscriptions.push(settings);
          return Promise.resolve(subscription);
        },
        connectProducer: () => Promise.reject(new Error('no dead letter was expected')),
      },
    );
    expect(consumer).toBeInstanceOf(KafkaEventConsumer);
    expect(consumer.isHealthy()).toBe(false);

    await consumer.start(() => Promise.resolve());
    expect(subscriptions).toEqual([
      {
        brokers: ['kafka-a:9092', 'kafka-b:9092'],
        clientId: 'notification',
        groupId: 'notification',
        topics: ['netverse.identity.events.v1'],
      },
    ]);
    expect(consumer.isHealthy()).toBe(true);
  });

  it('consumer group đổi được bằng cấu hình', async () => {
    const groups: string[] = [];
    const consumer = createEventConsumer(
      configOf({
        EVENT_TRANSPORT: 'kafka',
        KAFKA_BROKERS: 'kafka:9092',
        EVENT_CONSUMER_GROUP: 'notification-staging',
      }),
      processed,
      {
        subscribe: (settings: SubscriptionSettings) => {
          groups.push(settings.groupId);
          return Promise.resolve({ isConnected: () => true, stop: () => Promise.resolve() });
        },
        connectProducer: () => Promise.reject(new Error('no dead letter was expected')),
      },
    );
    await consumer.start(() => Promise.resolve());
    expect(groups).toEqual(['notification-staging']);
  });
});
