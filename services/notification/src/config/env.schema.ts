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

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const MAX_JOB_RUN_MS = 240_000;
const GUARDED_NAMES = ['DATABASE_URL', 'BREVO_API_KEY', 'FIREBASE_PRIVATE_KEY'];

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_PRETTY: booleanFlag.optional(),
  SERVICE_NAME: z.string().min(1),
  SERVICE_VERSION: z.string().min(1).default('0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: commaSeparated,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  BODY_LIMIT: z.string().min(1).default('1mb'),
  REQUEST_TIMEOUT_MS: positiveInt(30_000),
  SWAGGER_ENABLED: booleanFlag.optional(),
  RATE_LIMIT_TTL_MS: positiveInt(60_000),
  RATE_LIMIT_MAX: positiveInt(120),
  AUTH_JWKS_URL: z.url(),
  AUTH_ISSUER: z.string().min(1),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_ROLES_CLAIM: z.string().min(1).default('roles'),
  AUTH_TENANT_CLAIM: z.string().min(1).default('tenant_id'),

  DEFAULT_LOCALE: z.string().min(2).max(16).default('en'),
  EMAIL_PROVIDER: z.enum(['none', 'log', 'brevo']).default('log'),
  EMAIL_FROM_ADDRESS: z.email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  PUSH_PROVIDER: z.enum(['none', 'log', 'firebase']).default('log'),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  PROVIDER_TIMEOUT_MS: positiveInt(10_000),

  EVENT_TRANSPORT: z.enum(['none']).default('none'),

  KAFKA_BROKERS: commaSeparated,
  JOBS_ENABLED: booleanFlag.default(true),
  DELIVERY_POLL_INTERVAL_MS: positiveInt(2_000),
  DELIVERY_BATCH_SIZE: positiveInt(50),
  DELIVERY_CONCURRENCY: positiveInt(10),
  DELIVERY_MAX_ATTEMPTS: positiveInt(6),
  DELIVERY_RETRY_BASE_MS: positiveInt(30_000),
  DELIVERY_RETRY_MAX_MS: positiveInt(3_600_000),
  DELIVERY_LEASE_MS: positiveInt(300_000),
  OUTBOX_RELAY_INTERVAL_MS: positiveInt(5_000),
  OUTBOX_MAX_ATTEMPTS: positiveInt(12),
});

type BaseEnv = z.infer<typeof baseSchema>;

function requireWhen(
  env: BaseEnv,
  context: z.RefinementCtx,
  condition: boolean,
  names: (keyof BaseEnv)[],
  reason: string,
): void {
  if (!condition) {
    return;
  }
  for (const name of names) {
    if (env[name] === undefined) {
      context.addIssue({ code: 'custom', path: [name], message: `is required ${reason}` });
    }
  }
}

function refuseLogProvidersInProduction(env: BaseEnv, context: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  if (env.EMAIL_PROVIDER === 'log') {
    context.addIssue({
      code: 'custom',
      path: ['EMAIL_PROVIDER'],
      message: 'must not be log in production',
    });
  }
  if (env.PUSH_PROVIDER === 'log') {
    context.addIssue({
      code: 'custom',
      path: ['PUSH_PROVIDER'],
      message: 'must not be log in production',
    });
  }
}

function refuseSampleValuesInProduction(env: BaseEnv, context: z.RefinementCtx): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  for (const name of sampleSecretNames(env, GUARDED_NAMES)) {
    context.addIssue({
      code: 'custom',
      path: [name],
      message: 'sample value is not allowed in production',
    });
  }
}

function refuseBatchesThatOutliveTheLease(env: BaseEnv, context: z.RefinementCtx): void {
  const worstCaseMs =
    Math.ceil(env.DELIVERY_BATCH_SIZE / env.DELIVERY_CONCURRENCY) * env.PROVIDER_TIMEOUT_MS;
  if (worstCaseMs >= Math.min(env.DELIVERY_LEASE_MS, MAX_JOB_RUN_MS)) {
    context.addIssue({
      code: 'custom',
      path: ['DELIVERY_BATCH_SIZE'],
      message:
        'one batch must finish within DELIVERY_LEASE_MS and 240 seconds at the configured concurrency and timeout',
    });
  }
}

export const envSchema = baseSchema.superRefine((env, context) => {
  refuseLogProvidersInProduction(env, context);
  refuseSampleValuesInProduction(env, context);
  requireWhen(
    env,
    context,
    env.EMAIL_PROVIDER === 'brevo',
    ['BREVO_API_KEY', 'EMAIL_FROM_ADDRESS'],
    'when EMAIL_PROVIDER is brevo',
  );
  requireWhen(
    env,
    context,
    env.PUSH_PROVIDER === 'firebase',
    ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'],
    'when PUSH_PROVIDER is firebase',
  );
  refuseBatchesThatOutliveTheLease(env, context);
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseEnvWith(envSchema, source);
}
