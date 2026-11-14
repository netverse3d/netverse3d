import { Writable } from 'node:stream';
import pino from 'pino';
import { AppConfig } from '@app/config/app-config';
import { parseEnv } from '@app/config/env.schema';
import { buildPinoHttpOptions } from '@netverse/nest-kit';

function capturedLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const config = new AppConfig(
    parseEnv({
      NODE_ENV: 'test',
      SERVICE_NAME: 'svc',
      DATABASE_URL: 'postgresql://localhost/db',
      AUTH_JWKS_URL: 'http://localhost/jwks',
      AUTH_ISSUER: 'issuer',
      AUTH_AUDIENCE: 'audience',
    }),
  );
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
