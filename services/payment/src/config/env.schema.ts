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

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().min(1),
  SERVICE_VERSION: z.string().min(1).default('0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: commaSeparated,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  BODY_LIMIT: z.string().min(1).default('1mb'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  SWAGGER_ENABLED: booleanFlag.optional(),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_JWKS_URL: z.url(),
  AUTH_ISSUER: z.string().min(1),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_ROLES_CLAIM: z.string().min(1).default('roles'),
  AUTH_TENANT_CLAIM: z.string().min(1).default('tenant_id'),
  PROVIDER_CREDENTIALS_KEYS: z.string().default(''),
  PROVIDER_CREDENTIALS_ACTIVE_KEY_VERSION: z.string().default(''),
  OUTBOX_WORKER_ENABLED: booleanFlag.optional(),
  OUTBOX_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(12),
  RECONCILIATION_ENABLED: booleanFlag.optional(),
  RECONCILIATION_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  RECONCILE_MIN_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  RECONCILE_SPACING_SECONDS: z.coerce.number().int().positive().default(300),
  RECONCILE_MAX_AGE_HOURS: z.coerce.number().int().positive().default(72),
  RECONCILIATION_SERVER_IP: z.string().min(1).default('127.0.0.1'),
  OUTBOUND_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  PAYMENT_PROVIDERS_ENABLED: commaSeparated,
  PROVIDER_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  PAYMENT_EXPIRY_GRACE_MINUTES: z.coerce.number().int().positive().default(10),
  PAYMENT_REFRESH_MIN_INTERVAL_SECONDS: z.coerce.number().int().positive().default(10),
  VNPAY_PAYMENT_URL: z.url().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
  VNPAY_API_URL: z.url().default('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'),
  PAYOS_API_BASE_URL: z.url().default('https://api-merchant.payos.vn'),
  PAYOS_ORDER_CODE_OFFSET: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

function withoutBlanks(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(withoutBlanks(source));
  if (parsed.success) {
    return parsed.data;
  }
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment: ${problems}`);
}
