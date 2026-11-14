import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/bootstrap/setup-app';
import { AppConfig } from '../../src/config/app-config';
import { ConformanceProbeController } from './conformance-probe.controller';
import { TEST_AUDIENCE, TEST_ISSUER, TokenIssuer } from './token-issuer';

export interface TestApp {
  app: NestExpressApplication;
  tokens: TokenIssuer;
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
    OUTBOX_WORKER_ENABLED: 'false',
    RECONCILIATION_ENABLED: 'false',
    PAYMENT_PROVIDERS_ENABLED: 'vietqr',
    ...overrides,
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ConformanceProbeController],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    rawBody: true,
  });
  setupApp(app, app.get(AppConfig));
  await app.init();

  return {
    app,
    tokens,
    close: async () => {
      await app.close();
      await tokens.stop();
    },
  };
}
