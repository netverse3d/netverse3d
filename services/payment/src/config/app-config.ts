import { Env } from './env.schema';
import { KitConfig } from '@netverse/nest-kit';

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
  readonly swagger: { enabled: boolean; apiKeys: readonly { name: string; header: string }[] };
  readonly rateLimit: { ttlMs: number; max: number };
  readonly auth: {
    jwksUrl: string;
    issuer: string;
    audience: string;
    rolesClaim: string;
    tenantClaim: string;
  };
  readonly payment: {
    providerCredentialKeys: string;
    providerCredentialActiveKeyVersion: string;
    outboxWorkerEnabled: boolean;
    outboxWorkerIntervalMs: number;
    outboxMaxAttempts: number;
    reconciliationEnabled: boolean;
    reconciliationIntervalMs: number;
    reconcileMinAgeSeconds: number;
    reconcileSpacingSeconds: number;
    reconcileMaxAgeHours: number;
    reconciliationServerIp: string;
    outboundHttpTimeoutMs: number;
    providersEnabled: string[];
    providerHttpTimeoutMs: number;
    expiryGraceMinutes: number;
    refreshMinIntervalSeconds: number;
    vnpayPaymentUrl: string;
    vnpayApiUrl: string;
    payosApiBaseUrl: string;
    payosOrderCodeOffset: number;
  };
  readonly events = { brokers: [] as string[] };
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
    this.swagger = {
      enabled: env.NODE_ENV !== 'production' && (env.SWAGGER_ENABLED ?? true),
      apiKeys: [{ name: 'tenant-api-key', header: 'x-api-key' }],
    };
    this.rateLimit = { ttlMs: env.RATE_LIMIT_TTL_MS, max: env.RATE_LIMIT_MAX };
    this.auth = {
      jwksUrl: env.AUTH_JWKS_URL,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      rolesClaim: env.AUTH_ROLES_CLAIM,
      tenantClaim: env.AUTH_TENANT_CLAIM,
    };
    this.payment = {
      providerCredentialKeys: env.PROVIDER_CREDENTIALS_KEYS,
      providerCredentialActiveKeyVersion: env.PROVIDER_CREDENTIALS_ACTIVE_KEY_VERSION,
      outboxWorkerEnabled: env.OUTBOX_WORKER_ENABLED ?? true,
      outboxWorkerIntervalMs: env.OUTBOX_WORKER_INTERVAL_MS,
      outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
      reconciliationEnabled: env.RECONCILIATION_ENABLED ?? true,
      reconciliationIntervalMs: env.RECONCILIATION_INTERVAL_MS,
      reconcileMinAgeSeconds: env.RECONCILE_MIN_AGE_SECONDS,
      reconcileSpacingSeconds: env.RECONCILE_SPACING_SECONDS,
      reconcileMaxAgeHours: env.RECONCILE_MAX_AGE_HOURS,
      reconciliationServerIp: env.RECONCILIATION_SERVER_IP,
      outboundHttpTimeoutMs: env.OUTBOUND_HTTP_TIMEOUT_MS,
      providersEnabled: env.PAYMENT_PROVIDERS_ENABLED.map((code) => code.toLowerCase()),
      providerHttpTimeoutMs: env.PROVIDER_HTTP_TIMEOUT_MS,
      expiryGraceMinutes: env.PAYMENT_EXPIRY_GRACE_MINUTES,
      refreshMinIntervalSeconds: env.PAYMENT_REFRESH_MIN_INTERVAL_SECONDS,
      vnpayPaymentUrl: env.VNPAY_PAYMENT_URL,
      vnpayApiUrl: env.VNPAY_API_URL,
      payosApiBaseUrl: env.PAYOS_API_BASE_URL,
      payosOrderCodeOffset: env.PAYOS_ORDER_CODE_OFFSET,
    };
    this.jobs = {
      enabled: env.OUTBOX_WORKER_ENABLED ?? true,
      outboxRelayIntervalMs: env.OUTBOX_WORKER_INTERVAL_MS,
      outboxMaxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    };
  }
}
