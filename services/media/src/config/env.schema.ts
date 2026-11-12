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

const contentTypeList = (fallback: string) =>
  z
    .string()
    .min(1)
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    );

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
    AUTH_JWKS_URL: z.url(),
    AUTH_ISSUER: z.string().min(1),
    AUTH_AUDIENCE: z.string().min(1),
    AUTH_ROLES_CLAIM: z.string().min(1).default('roles'),
    AUTH_TENANT_CLAIM: z.string().min(1).default('tenant_id'),

    S3_ENDPOINT: z.string().min(1),
    S3_PORT: z.coerce.number().int().min(1).max(65535),
    S3_USE_SSL: booleanFlag.default(false),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_PUBLIC_ENDPOINT: z.string().min(1).optional(),
    S3_PUBLIC_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    S3_PUBLIC_USE_SSL: booleanFlag.optional(),
    S3_BUCKET_PRIVATE: z.string().min(3),
    S3_BUCKET_INTERNAL: z.string().min(3),
    S3_BUCKET_PUBLIC: z.string().min(3),
    S3_BUCKET_TEMP: z.string().min(3),
    S3_AUTO_CREATE_BUCKETS: booleanFlag.default(false),
    S3_UPLOAD_URL_TTL_SECONDS: positiveInt(900),
    S3_DOWNLOAD_URL_TTL_SECONDS: positiveInt(300),

    MEDIA_SYSTEM_ASSET_ALLOWED_TYPES: contentTypeList(
      'image/*,audio/*,video/*,model/gltf-binary,model/gltf+json,application/pdf',
    ),
    MEDIA_SYSTEM_ASSET_MAX_BYTES: positiveInt(524_288_000),
    MEDIA_USER_CONTENT_ALLOWED_TYPES: contentTypeList(
      'image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/ogg,audio/wav,video/mp4,application/pdf',
    ),
    MEDIA_USER_CONTENT_MAX_BYTES: positiveInt(26_214_400),
    MEDIA_USER_CONTENT_REQUIRES_REVIEW: booleanFlag.default(false),

    JOBS_ENABLED: booleanFlag.default(true),
    MEDIA_PENDING_EXPIRY_SECONDS: positiveInt(86_400),
    MEDIA_HARD_DELETE_GRACE_SECONDS: positiveInt(86_400),
    MEDIA_REAPER_INTERVAL_SECONDS: positiveInt(300),
    OUTBOX_RELAY_INTERVAL_MS: positiveInt(5_000),
    OUTBOX_MAX_ATTEMPTS: positiveInt(12),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production') {
      for (const name of sampleSecretNames(env, ['S3_SECRET_KEY'])) {
        context.addIssue({
          code: 'custom',
          path: [name],
          message: 'sample value is not allowed in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseEnvWith(envSchema, source);
}
