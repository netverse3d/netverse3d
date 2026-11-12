import { KitConfig } from '@netverse/nest-kit';
import { Env } from './env.schema';

export interface S3Endpoint {
  endPoint: string;
  port: number;
  useSSL: boolean;
}

export interface UploadPolicy {
  allowedTypes: string[];
  maxBytes: number;
}

export class AppConfig extends KitConfig {
  readonly service: { name: string; version: string; environment: Env['NODE_ENV'] };
  readonly http: {
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    bodyLimit: string;
    requestTimeoutMs: number;
  };
  readonly log: { level: Env['LOG_LEVEL']; pretty: boolean };
  readonly database: { url: string };
  readonly swagger: { enabled: boolean };
  readonly rateLimit: { ttlMs: number; max: number };
  readonly auth: {
    jwksUrl: string;
    issuer: string;
    audience: string;
    rolesClaim: string;
    tenantClaim: string;
  };
  readonly storage: {
    internal: S3Endpoint;
    public: S3Endpoint;
    region: string;
    accessKey: string;
    secretKey: string;
    buckets: { private: string; internal: string; public: string; temp: string };
    autoCreateBuckets: boolean;
    uploadUrlTtlSeconds: number;
    downloadUrlTtlSeconds: number;
  };
  readonly media: {
    systemAsset: UploadPolicy;
    userContent: UploadPolicy;
    userContentRequiresReview: boolean;
  };
  readonly jobs: {
    enabled: boolean;
    pendingExpirySeconds: number;
    hardDeleteGraceSeconds: number;
    reaperIntervalSeconds: number;
    outboxRelayIntervalMs: number;
    outboxMaxAttempts: number;
  };

  constructor(env: Env) {
    super();
    this.service = {
      name: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      environment: env.NODE_ENV,
    };
    this.http = {
      port: env.PORT,
      corsOrigins: env.CORS_ORIGINS,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      bodyLimit: env.BODY_LIMIT,
      requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
    };
    this.log = { level: env.LOG_LEVEL, pretty: env.LOG_PRETTY ?? env.NODE_ENV === 'development' };
    this.database = { url: env.DATABASE_URL };
    this.swagger = { enabled: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production' };
    this.rateLimit = { ttlMs: env.RATE_LIMIT_TTL_MS, max: env.RATE_LIMIT_MAX };
    this.auth = {
      jwksUrl: env.AUTH_JWKS_URL,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      rolesClaim: env.AUTH_ROLES_CLAIM,
      tenantClaim: env.AUTH_TENANT_CLAIM,
    };
    const internal = { endPoint: env.S3_ENDPOINT, port: env.S3_PORT, useSSL: env.S3_USE_SSL };
    this.storage = {
      internal,
      public: {
        endPoint: env.S3_PUBLIC_ENDPOINT ?? internal.endPoint,
        port: env.S3_PUBLIC_PORT ?? internal.port,
        useSSL: env.S3_PUBLIC_USE_SSL ?? internal.useSSL,
      },
      region: env.S3_REGION,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      buckets: {
        private: env.S3_BUCKET_PRIVATE,
        internal: env.S3_BUCKET_INTERNAL,
        public: env.S3_BUCKET_PUBLIC,
        temp: env.S3_BUCKET_TEMP,
      },
      autoCreateBuckets: env.S3_AUTO_CREATE_BUCKETS,
      uploadUrlTtlSeconds: env.S3_UPLOAD_URL_TTL_SECONDS,
      downloadUrlTtlSeconds: env.S3_DOWNLOAD_URL_TTL_SECONDS,
    };
    this.media = {
      systemAsset: {
        allowedTypes: env.MEDIA_SYSTEM_ASSET_ALLOWED_TYPES,
        maxBytes: env.MEDIA_SYSTEM_ASSET_MAX_BYTES,
      },
      userContent: {
        allowedTypes: env.MEDIA_USER_CONTENT_ALLOWED_TYPES,
        maxBytes: env.MEDIA_USER_CONTENT_MAX_BYTES,
      },
      userContentRequiresReview: env.MEDIA_USER_CONTENT_REQUIRES_REVIEW,
    };
    this.jobs = {
      enabled: env.JOBS_ENABLED,
      pendingExpirySeconds: env.MEDIA_PENDING_EXPIRY_SECONDS,
      hardDeleteGraceSeconds: env.MEDIA_HARD_DELETE_GRACE_SECONDS,
      reaperIntervalSeconds: env.MEDIA_REAPER_INTERVAL_SECONDS,
      outboxRelayIntervalMs: env.OUTBOX_RELAY_INTERVAL_MS,
      outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    };
  }
}
