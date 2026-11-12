import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/bootstrap/setup-app';
import { AppConfig } from '../../src/config/app-config';
import { StorageService } from '../../src/infrastructure/storage/storage.service';
import { ConformanceProbeController } from './conformance-probe.controller';
import { InMemoryStorage } from './in-memory-storage';
import { TEST_AUDIENCE, TEST_ISSUER, TokenIssuer } from './token-issuer';

export interface TestApp {
  app: NestExpressApplication;
  tokens: TokenIssuer;
  storage: InMemoryStorage;
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
    S3_ENDPOINT: 'storage.test',
    S3_PORT: '9000',
    S3_ACCESS_KEY: 'test-access',
    S3_SECRET_KEY: 'test-secret',
    S3_BUCKET_PRIVATE: 'test-private',
    S3_BUCKET_INTERNAL: 'test-internal',
    S3_BUCKET_PUBLIC: 'test-public',
    S3_BUCKET_TEMP: 'test-temp',
    S3_AUTO_CREATE_BUCKETS: 'false',
    MEDIA_USER_CONTENT_MAX_BYTES: '1000',
    MEDIA_SYSTEM_ASSET_MAX_BYTES: '100000',
    MEDIA_USER_CONTENT_REQUIRES_REVIEW: 'false',
    JOBS_ENABLED: 'false',
    MEDIA_PENDING_EXPIRY_SECONDS: '3600',
    MEDIA_HARD_DELETE_GRACE_SECONDS: '3600',
    OUTBOX_MAX_ATTEMPTS: '3',
    ...overrides,
  });

  const storage = new InMemoryStorage();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ConformanceProbeController],
  })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  setupApp(app, app.get(AppConfig));
  await app.init();

  return {
    app,
    tokens,
    storage,
    close: async () => {
      await app.close();
      await tokens.stop();
    },
  };
}
