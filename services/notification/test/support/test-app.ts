import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '@netverse/nest-kit';
import { AppConfig } from '../../src/config/app-config';
import {
  ChannelSender,
  EMAIL_SENDER,
  OutboundMessage,
  PUSH_SENDER,
  SendReceipt,
} from '../../src/modules/channels/ports/channel-sender';
import {
  EventConsumer,
  EventEnvelope,
  EventPayloadHandler,
  EventPublisher,
} from '@netverse/nest-kit';
import { ConformanceProbeController } from '@netverse/nest-kit/testing';
import { TEST_AUDIENCE, TEST_ISSUER, TokenIssuer } from '@netverse/nest-kit/testing';

export class InMemoryChannelSender extends ChannelSender {
  readonly sent: OutboundMessage[] = [];
  failure: Error | null = null;
  delayMs = 0;

  async send(message: OutboundMessage): Promise<SendReceipt> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failure) {
      throw this.failure;
    }
    this.sent.push(message);
    return { providerMessageId: `memory-${message.deliveryId}` };
  }

  forEvent(eventType: string): OutboundMessage[] {
    return this.sent.filter((message) => message.eventType === eventType);
  }

  reset(): void {
    this.sent.length = 0;
    this.failure = null;
    this.delayMs = 0;
  }
}

export class InMemoryEventConsumer extends EventConsumer {
  healthy = true;
  private handler?: EventPayloadHandler;

  start(handler: EventPayloadHandler): Promise<void> {
    this.handler = handler;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  deliver(event: unknown): Promise<void> {
    return this.deliverRaw(Buffer.from(JSON.stringify(event)));
  }

  deliverRaw(payload: Buffer): Promise<void> {
    return (this.handler as EventPayloadHandler)(payload);
  }
}

export class CapturingEventPublisher extends EventPublisher {
  readonly events: EventEnvelope[] = [];

  publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

export interface TestApp {
  app: NestExpressApplication;
  tokens: TokenIssuer;
  email: InMemoryChannelSender;
  push: InMemoryChannelSender;
  events: InMemoryEventConsumer;
  publisher: CapturingEventPublisher;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const tokens = await TokenIssuer.start();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SERVICE_NAME: 'service-under-test',
    SERVICE_VERSION: '9.9.9',
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'true',
    BODY_LIMIT: '1mb',
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_TTL_MS: '60000',
    REQUEST_TIMEOUT_MS: '30000',
    AUTH_JWKS_URL: tokens.jwksUrl,
    AUTH_ISSUER: TEST_ISSUER,
    AUTH_AUDIENCE: TEST_AUDIENCE,
    EMAIL_PROVIDER: 'log',
    PUSH_PROVIDER: 'log',
    EVENT_TRANSPORT: 'none',
    DEFAULT_LOCALE: 'en',
    JOBS_ENABLED: 'false',
    DELIVERY_MAX_ATTEMPTS: '3',
    DELIVERY_RETRY_BASE_MS: '60000',
    DELIVERY_RETRY_MAX_MS: '3600000',
    DELIVERY_LEASE_MS: '300000',
    OUTBOX_MAX_ATTEMPTS: '3',
    ...overrides,
  });

  const email = new InMemoryChannelSender();
  const push = new InMemoryChannelSender();
  const events = new InMemoryEventConsumer();
  const publisher = new CapturingEventPublisher();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ConformanceProbeController],
  })
    .overrideProvider(EMAIL_SENDER)
    .useValue(email)
    .overrideProvider(PUSH_SENDER)
    .useValue(push)
    .overrideProvider(EventConsumer)
    .useValue(events)
    .overrideProvider(EventPublisher)
    .useValue(publisher)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  setupApp(app, app.get(AppConfig));
  await app.init();

  return {
    app,
    tokens,
    email,
    push,
    events,
    publisher,
    close: async () => {
      await app.close();
      await tokens.stop();
    },
  };
}
