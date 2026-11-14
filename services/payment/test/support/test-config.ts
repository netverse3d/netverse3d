import { AppConfig } from '../../src/config/app-config';
import { parseEnv } from '../../src/config/env.schema';

export function testAppConfig(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig(
    parseEnv({
      SERVICE_NAME: 'service-under-test',
      DATABASE_URL: 'postgresql://localhost/unused',
      AUTH_JWKS_URL: 'http://localhost/jwks.json',
      AUTH_ISSUER: 'https://issuer.test',
      AUTH_AUDIENCE: 'service-under-test',
      ...overrides,
    }),
  );
}
