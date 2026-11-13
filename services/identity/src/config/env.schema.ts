import { parseEnvWith, sampleSecretNames } from '@netverse/nest-kit';
import { z } from 'zod';

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

const commaSeparated = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const GUARDED_NAMES = [
  'DATABASE_URL',
  'FACEBOOK_APP_SECRET',
  'GITHUB_CLIENT_SECRET',
  'ZALO_APP_SECRET',
  'KEY_ENCRYPTION_SECRET',
  'OTP_HASH_SECRET',
  'OTP_WEBHOOK_SECRET',
  'BOOTSTRAP_ADMIN_PASSWORD',
];

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_PRETTY: booleanFlag.optional(),
    SERVICE_NAME: z.string().min(1),
    SERVICE_VERSION: z.string().min(1).default('0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: commaSeparated,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    BODY_LIMIT: z.string().min(1).default('1mb'),
    REQUEST_TIMEOUT_MS: positiveInt(30_000),
    SWAGGER_ENABLED: booleanFlag.optional(),
    RATE_LIMIT_TTL_MS: positiveInt(60_000),
    RATE_LIMIT_MAX: positiveInt(120),
    AUTH_RATE_LIMIT_MAX: positiveInt(20),
    AUTH_JWKS_URL: z.url(),
    AUTH_ISSUER: z.string().min(1),
    AUTH_AUDIENCE: z.string().min(1),
    AUTH_JWKS_COOLDOWN_MS: z.coerce.number().int().min(0).default(5_000),
    AUTH_ROLES_CLAIM: z.string().min(1).default('roles'),
    AUTH_TENANT_CLAIM: z.string().min(1).default('tenant_id'),

    TOKEN_AUDIENCES: commaSeparated,
    ACCESS_TOKEN_TTL_SECONDS: positiveInt(900),
    SERVICE_TOKEN_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
    REFRESH_TOKEN_TTL_DAYS: positiveInt(30),
    REFRESH_REUSE_GRACE_SECONDS: positiveInt(10),
    KEY_ENCRYPTION_SECRET: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hexadecimal characters'),
    KEY_RETIRE_GRACE_HOURS: positiveInt(24),

    PASSWORD_BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
    LOGIN_MAX_FAILURES: positiveInt(5),
    LOGIN_LOCK_MINUTES: positiveInt(15),

    OTP_TTL_MINUTES: positiveInt(10),
    OTP_MAX_ATTEMPTS: positiveInt(5),
    OTP_RESEND_COOLDOWN_SECONDS: positiveInt(60),
    OTP_HASH_SECRET: z.string().min(32),
    OTP_DELIVERY: z.enum(['log', 'webhook']).default('log'),
    OTP_WEBHOOK_URL: z.url().optional(),
    OTP_WEBHOOK_SECRET: z.string().min(32).optional(),

    GOOGLE_CLIENT_IDS: commaSeparated,
    GOOGLE_JWKS_URL: z.url().default('https://www.googleapis.com/oauth2/v3/certs'),
    GOOGLE_ISSUERS: commaSeparated,
    APPLE_CLIENT_IDS: commaSeparated,
    APPLE_JWKS_URL: z.url().default('https://appleid.apple.com/auth/keys'),
    APPLE_ISSUER: z.string().min(1).default('https://appleid.apple.com'),
    FACEBOOK_APP_ID: z.string().min(1).optional(),
    FACEBOOK_APP_SECRET: z.string().min(1).optional(),
    FACEBOOK_GRAPH_URL: z.url().default('https://graph.facebook.com/v19.0'),
    ZALO_APP_SECRET: z.string().min(1).optional(),
    ZALO_GRAPH_URL: z.url().default('https://graph.zalo.me/v2.0'),
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_OAUTH_URL: z.url().default('https://github.com/login/oauth/access_token'),
    GITHUB_API_URL: z.url().default('https://api.github.com'),

    BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(72).optional(),

    KAFKA_BROKERS: commaSeparated,
    JOBS_ENABLED: booleanFlag.default(true),
    CLEANUP_INTERVAL_SECONDS: positiveInt(3_600),
    OUTBOX_RELAY_INTERVAL_MS: positiveInt(5_000),
    OUTBOX_MAX_ATTEMPTS: positiveInt(12),
  })
  .superRefine((env, context) => {
    const missing = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (env.NODE_ENV === 'production') {
      if (env.KAFKA_BROKERS.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['KAFKA_BROKERS'],
          message: 'is required in production',
        });
      }
      for (const name of sampleSecretNames(env, GUARDED_NAMES)) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: 'sample value is not allowed in production',
        });
      }
    }
    if (env.NODE_ENV === 'production' && env.OTP_DELIVERY === 'log') {
      missing('OTP_DELIVERY', 'log delivery would write one-time codes to logs in production');
    }
    if (env.OTP_DELIVERY === 'webhook' && !env.OTP_WEBHOOK_URL) {
      missing('OTP_WEBHOOK_URL', 'required when OTP_DELIVERY is webhook');
    }
    if (env.OTP_DELIVERY === 'webhook' && !env.OTP_WEBHOOK_SECRET) {
      missing('OTP_WEBHOOK_SECRET', 'required when OTP_DELIVERY is webhook');
    }
    if (Boolean(env.BOOTSTRAP_ADMIN_EMAIL) !== Boolean(env.BOOTSTRAP_ADMIN_PASSWORD)) {
      missing(
        'BOOTSTRAP_ADMIN_PASSWORD',
        'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD go together',
      );
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseEnvWith(envSchema, source);
}
