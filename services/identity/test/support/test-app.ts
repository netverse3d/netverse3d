import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '@netverse/nest-kit';
import { AppConfig } from '../../src/config/app-config';
import { OtpMessage, OtpSender } from '../../src/modules/identity/ports/otp-sender';
import { KeysService } from '../../src/modules/keys/services/keys.service';
import { ConformanceProbeController } from '@netverse/nest-kit/testing';
import {
  APPLE_CLIENT,
  APPLE_ISSUER,
  FACEBOOK_APP,
  FACEBOOK_SECRET,
  FakeSocialProviders,
  GITHUB_CLIENT,
  GITHUB_SECRET,
  GOOGLE_CLIENT,
  GOOGLE_ISSUER,
  ZALO_SECRET,
} from './fake-social-providers';
import { TEST_AUDIENCE, TEST_ISSUER, TokenIssuer } from '@netverse/nest-kit/testing';

export const BOOTSTRAP_ADMIN = { email: 'root@identity.test', password: 'bootstrap-password-1' };

export class CapturingOtpSender extends OtpSender {
  readonly messages: OtpMessage[] = [];

  send(message: OtpMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  latestFor(email: string): OtpMessage | undefined {
    return [...this.messages].reverse().find((message) => message.email === email);
  }
}

export interface TestApp {
  app: NestExpressApplication;
  tokens: TokenIssuer;
  otp: CapturingOtpSender;
  social: FakeSocialProviders;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const tokens = await TokenIssuer.start();
  const social = await FakeSocialProviders.start();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SERVICE_NAME: 'service-under-test',
    SERVICE_VERSION: '9.9.9',
    LOG_LEVEL: 'silent',
    SWAGGER_ENABLED: 'true',
    BODY_LIMIT: '1mb',
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_TTL_MS: '60000',
    REQUEST_TIMEOUT_MS: '30000',
    AUTH_JWKS_URL: tokens.jwksUrl,
    AUTH_JWKS_COOLDOWN_MS: '0',
    AUTH_ISSUER: TEST_ISSUER,
    AUTH_AUDIENCE: TEST_AUDIENCE,
    KEY_ENCRYPTION_SECRET: 'c'.repeat(64),
    OTP_HASH_SECRET: 'd'.repeat(32),
    OTP_DELIVERY: 'log',
    OTP_RESEND_COOLDOWN_SECONDS: '60',
    OTP_MAX_ATTEMPTS: '3',
    PASSWORD_BCRYPT_COST: '4',
    LOGIN_MAX_FAILURES: '3',
    REFRESH_REUSE_GRACE_SECONDS: '10',
    GOOGLE_CLIENT_IDS: GOOGLE_CLIENT,
    GOOGLE_JWKS_URL: `${social.baseUrl}/jwks`,
    GOOGLE_ISSUERS: GOOGLE_ISSUER,
    APPLE_CLIENT_IDS: APPLE_CLIENT,
    APPLE_JWKS_URL: `${social.baseUrl}/jwks`,
    APPLE_ISSUER,
    FACEBOOK_APP_ID: FACEBOOK_APP,
    FACEBOOK_APP_SECRET: FACEBOOK_SECRET,
    FACEBOOK_GRAPH_URL: `${social.baseUrl}/facebook`,
    ZALO_APP_SECRET: ZALO_SECRET,
    ZALO_GRAPH_URL: `${social.baseUrl}/zalo`,
    GITHUB_CLIENT_ID: GITHUB_CLIENT,
    GITHUB_CLIENT_SECRET: GITHUB_SECRET,
    GITHUB_OAUTH_URL: `${social.baseUrl}/github/token`,
    GITHUB_API_URL: `${social.baseUrl}/github`,
    BOOTSTRAP_ADMIN_EMAIL: BOOTSTRAP_ADMIN.email,
    BOOTSTRAP_ADMIN_PASSWORD: BOOTSTRAP_ADMIN.password,
    JOBS_ENABLED: 'false',
    OUTBOX_MAX_ATTEMPTS: '3',
    ...overrides,
  });

  const otp = new CapturingOtpSender();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ConformanceProbeController],
  })
    .overrideProvider(OtpSender)
    .useValue(otp)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  setupApp(app, app.get(AppConfig));
  await app.init();
  const keys = app.get(KeysService, { strict: false });
  tokens.publishAlso(() => keys.publicKeySet());

  return {
    app,
    tokens,
    otp,
    social,
    close: async () => {
      await app.close();
      await tokens.stop();
      await social.stop();
    },
  };
}
