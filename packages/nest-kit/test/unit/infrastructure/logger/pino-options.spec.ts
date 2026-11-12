import { Writable } from 'node:stream';
import pino from 'pino';
import { KitConfig } from '../../../../src/config/kit-config';
import { buildPinoHttpOptions } from '../../../../src/infrastructure/logger/pino-options';

function capturedLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const config: KitConfig = {
    service: { name: 'svc', version: '0.1.0', environment: 'test' },
    http: {
      port: 3000,
      corsOrigins: [],
      trustProxyHops: 0,
      bodyLimit: '1mb',
      requestTimeoutMs: 30_000,
    },
    log: { level: 'info', pretty: false },
    swagger: { enabled: false },
    rateLimit: { ttlMs: 60_000, max: 120 },
    auth: {
      jwksUrl: 'http://localhost/jwks',
      issuer: 'issuer',
      audience: 'audience',
      rolesClaim: 'roles',
      tenantClaim: 'tenant_id',
    },
    jobs: { enabled: false, outboxRelayIntervalMs: 5_000, outboxMaxAttempts: 12 },
  };
  const { redact, base, level } = buildPinoHttpOptions(config);
  return { logger: pino({ redact, base, level }, stream), lines };
}

describe('log có cấu trúc', () => {
  it('che mật khẩu, token và header xác thực', () => {
    const { logger, lines } = capturedLogger();
    logger.info({
      password: 'hunter2',
      user: { token: 'tok-value' },
      req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
    });
    const output = lines.join('');
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('tok-value');
    expect(output).not.toContain('Bearer abc');
    expect(output).not.toContain('sid=1');
  });

  it('gắn tên service vào mọi dòng log', () => {
    const { logger, lines } = capturedLogger();
    logger.info('hello');
    expect(JSON.parse(lines[0] ?? '{}').service).toBe('svc');
  });
});
