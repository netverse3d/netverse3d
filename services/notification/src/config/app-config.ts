import { KitConfig } from '@netverse/nest-kit';
import { Env } from './env.schema';

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
  readonly notification: { defaultLocale: string };
  readonly email: {
    provider: Env['EMAIL_PROVIDER'];
    fromAddress?: string;
    fromName?: string;
    brevoApiKey?: string;
  };
  readonly push: {
    provider: Env['PUSH_PROVIDER'];
    firebaseProjectId?: string;
    firebaseClientEmail?: string;
    firebasePrivateKey?: string;
  };
  readonly providers: { timeoutMs: number };
  override readonly grpc?: { port: number };
  readonly events: { transport: Env['EVENT_TRANSPORT']; brokers: string[] };
  readonly delivery: {
    pollIntervalMs: number;
    batchSize: number;
    concurrency: number;
    maxAttempts: number;
    retryBaseMs: number;
    retryMaxMs: number;
    leaseMs: number;
  };
  readonly jobs: { enabled: boolean; outboxRelayIntervalMs: number; outboxMaxAttempts: number };

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
    this.notification = { defaultLocale: env.DEFAULT_LOCALE };
    this.email = {
      provider: env.EMAIL_PROVIDER,
      fromAddress: env.EMAIL_FROM_ADDRESS,
      fromName: env.EMAIL_FROM_NAME,
      brevoApiKey: env.BREVO_API_KEY,
    };
    this.push = {
      provider: env.PUSH_PROVIDER,
      firebaseProjectId: env.FIREBASE_PROJECT_ID,
      firebaseClientEmail: env.FIREBASE_CLIENT_EMAIL,
      firebasePrivateKey: env.FIREBASE_PRIVATE_KEY,
    };
    this.providers = { timeoutMs: env.PROVIDER_TIMEOUT_MS };
    this.grpc = env.GRPC_PORT === undefined ? undefined : { port: env.GRPC_PORT };
    this.events = { transport: env.EVENT_TRANSPORT, brokers: env.KAFKA_BROKERS };
    this.delivery = {
      pollIntervalMs: env.DELIVERY_POLL_INTERVAL_MS,
      batchSize: env.DELIVERY_BATCH_SIZE,
      concurrency: env.DELIVERY_CONCURRENCY,
      maxAttempts: env.DELIVERY_MAX_ATTEMPTS,
      retryBaseMs: env.DELIVERY_RETRY_BASE_MS,
      retryMaxMs: env.DELIVERY_RETRY_MAX_MS,
      leaseMs: env.DELIVERY_LEASE_MS,
    };
    this.jobs = {
      enabled: env.JOBS_ENABLED,
      outboxRelayIntervalMs: env.OUTBOX_RELAY_INTERVAL_MS,
      outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    };
  }
}
