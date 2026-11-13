export type Environment = 'development' | 'test' | 'production';

export abstract class KitConfig {
  abstract readonly service: { name: string; version: string; environment: Environment };
  abstract readonly http: {
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    bodyLimit: string;
    requestTimeoutMs: number;
  };
  abstract readonly log: { level: string; pretty: boolean };
  abstract readonly swagger: { enabled: boolean };
  abstract readonly rateLimit: { ttlMs: number; max: number; authMax?: number };
  abstract readonly auth: {
    jwksUrl: string;
    issuer: string;
    audience: string;
    rolesClaim: string;
    tenantClaim: string;
    jwksCooldownMs?: number;
  };
  abstract readonly events: { brokers: string[] };
  abstract readonly jobs: {
    enabled: boolean;
    outboxRelayIntervalMs: number;
    outboxMaxAttempts: number;
  };
}
