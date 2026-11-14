import { KitConfig } from '@netverse/nest-kit';
import { Env } from './env.schema';

const DEFAULT_GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

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
  readonly rateLimit: { ttlMs: number; max: number; authMax: number };
  readonly auth: {
    jwksUrl: string;
    jwksCooldownMs: number;
    issuer: string;
    audience: string;
    rolesClaim: string;
    tenantClaim: string;
  };
  readonly tokens: {
    audiences: string[];
    accessTtlSeconds: number;
    serviceTtlSeconds: number;
    refreshTtlDays: number;
    refreshReuseGraceSeconds: number;
    keyEncryptionSecret: string;
    keyRetireGraceHours: number;
  };
  readonly password: { bcryptCost: number; maxFailures: number; lockMinutes: number };
  readonly otp: {
    ttlMinutes: number;
    maxAttempts: number;
    resendCooldownSeconds: number;
    hashSecret: string;
    delivery: Env['OTP_DELIVERY'];
    webhookUrl?: string;
    webhookSecret?: string;
    notificationAddress?: string;
    notificationAudience: string;
  };
  readonly social: {
    google: { clientIds: string[]; jwksUrl: string; issuers: string[] };
    apple: { clientIds: string[]; jwksUrl: string; issuer: string };
    facebook: { appId?: string; appSecret?: string; graphUrl: string };
    zalo: { appSecret?: string; graphUrl: string };
    github: { clientId?: string; clientSecret?: string; oauthUrl: string; apiUrl: string };
  };
  readonly bootstrap: { adminEmail?: string; adminPassword?: string };
  readonly events: { brokers: string[] };
  readonly jobs: {
    enabled: boolean;
    cleanupIntervalSeconds: number;
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
    this.rateLimit = {
      ttlMs: env.RATE_LIMIT_TTL_MS,
      max: env.RATE_LIMIT_MAX,
      authMax: env.AUTH_RATE_LIMIT_MAX,
    };
    this.auth = {
      jwksUrl: env.AUTH_JWKS_URL,
      jwksCooldownMs: env.AUTH_JWKS_COOLDOWN_MS,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      rolesClaim: env.AUTH_ROLES_CLAIM,
      tenantClaim: env.AUTH_TENANT_CLAIM,
    };
    this.tokens = {
      audiences: [...new Set([env.AUTH_AUDIENCE, ...env.TOKEN_AUDIENCES])],
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      serviceTtlSeconds: env.SERVICE_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      refreshReuseGraceSeconds: env.REFRESH_REUSE_GRACE_SECONDS,
      keyEncryptionSecret: env.KEY_ENCRYPTION_SECRET,
      keyRetireGraceHours: env.KEY_RETIRE_GRACE_HOURS,
    };
    this.password = {
      bcryptCost: env.PASSWORD_BCRYPT_COST,
      maxFailures: env.LOGIN_MAX_FAILURES,
      lockMinutes: env.LOGIN_LOCK_MINUTES,
    };
    this.otp = {
      ttlMinutes: env.OTP_TTL_MINUTES,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      hashSecret: env.OTP_HASH_SECRET,
      delivery: env.OTP_DELIVERY,
      webhookUrl: env.OTP_WEBHOOK_URL,
      webhookSecret: env.OTP_WEBHOOK_SECRET,
      notificationAddress: env.OTP_NOTIFICATION_ADDRESS,
      notificationAudience: env.OTP_NOTIFICATION_AUDIENCE,
    };
    this.social = {
      google: {
        clientIds: env.GOOGLE_CLIENT_IDS,
        jwksUrl: env.GOOGLE_JWKS_URL,
        issuers: env.GOOGLE_ISSUERS.length > 0 ? env.GOOGLE_ISSUERS : DEFAULT_GOOGLE_ISSUERS,
      },
      apple: {
        clientIds: env.APPLE_CLIENT_IDS,
        jwksUrl: env.APPLE_JWKS_URL,
        issuer: env.APPLE_ISSUER,
      },
      facebook: {
        appId: env.FACEBOOK_APP_ID,
        appSecret: env.FACEBOOK_APP_SECRET,
        graphUrl: env.FACEBOOK_GRAPH_URL,
      },
      zalo: { appSecret: env.ZALO_APP_SECRET, graphUrl: env.ZALO_GRAPH_URL },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        oauthUrl: env.GITHUB_OAUTH_URL,
        apiUrl: env.GITHUB_API_URL,
      },
    };
    this.bootstrap = {
      adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
      adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
    };
    this.events = { brokers: env.KAFKA_BROKERS };
    this.jobs = {
      enabled: env.JOBS_ENABLED,
      cleanupIntervalSeconds: env.CLEANUP_INTERVAL_SECONDS,
      outboxRelayIntervalMs: env.OUTBOX_RELAY_INTERVAL_MS,
      outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    };
  }
}
