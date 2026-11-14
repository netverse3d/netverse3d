import {
  connectProducer,
  deadLetterSinkOf,
  EventConsumer,
  EventProducer,
  EventSubscription,
  KafkaEventConsumer,
  KafkaSettings,
  MessageHandler,
  NoneEventConsumer,
  ProcessedEvents,
  SubscriptionSettings,
  subscribeToTopics,
  topicFor,
} from '@netverse/nest-kit';
import { AppConfig } from '../../config/app-config';
import { listenedSources } from './domain/event-reactions';

export interface KafkaWiring {
  subscribe(settings: SubscriptionSettings, handler: MessageHandler): Promise<EventSubscription>;
  connectProducer(settings: KafkaSettings): Promise<EventProducer>;
}

const REAL_KAFKA: KafkaWiring = { subscribe: subscribeToTopics, connectProducer };

export function createEventConsumer(
  config: AppConfig,
  processed: ProcessedEvents,
  kafka: KafkaWiring = REAL_KAFKA,
): EventConsumer {
  if (config.events.transport !== 'kafka') {
    return new NoneEventConsumer();
  }
  const connection: KafkaSettings = {
    brokers: config.events.brokers,
    clientId: config.service.name,
  };
  let producer: Promise<EventProducer> | null = null;
  return new KafkaEventConsumer(
    (handler) =>
      kafka.subscribe(
        {
          ...connection,
          groupId: config.events.consumerGroup,
          topics: listenedSources().map(topicFor),
        },
        handler,
      ),
    async (letter) => {
      producer ??= kafka.connectProducer(connection);
      await deadLetterSinkOf(await producer)(letter);
    },
    processed,
  );
}
