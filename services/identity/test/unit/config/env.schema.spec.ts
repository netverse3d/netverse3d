import { AppConfig } from '../../../src/config/app-config';
import { parseEnv } from '../../../src/config/env.schema';

const valid = {
  SERVICE_NAME: 'svc',
  DATABASE_URL: 'postgresql://user:hunter2@localhost/db',
  AUTH_JWKS_URL: 'http://localhost:3000/.well-known/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
  KEY_ENCRYPTION_SECRET: 'a'.repeat(64),
  OTP_HASH_SECRET: 'b'.repeat(32),
};

const production = {
  ...valid,
  NODE_ENV: 'production',
  OTP_DELIVERY: 'webhook',
  OTP_WEBHOOK_URL: 'https://otp.internal/send',
  OTP_WEBHOOK_SECRET: 'c'.repeat(32),
};
const SAMPLE_HEX = '00112233445566778899aabbccddeeff'.repeat(2);
const SAMPLE_PHRASE = `local-development-${'x'.repeat(24)}`;

describe('giá trị mẫu ở production', () => {
  it.each([
    ['KEY_ENCRYPTION_SECRET', SAMPLE_HEX],
    ['OTP_HASH_SECRET', SAMPLE_PHRASE],
    ['OTP_WEBHOOK_SECRET', SAMPLE_PHRASE],
  ])('production từ chối boot khi %s là giá trị mẫu', (name, value) => {
    expect(() => parseEnv({ ...production, [name]: value })).toThrow(
      `${name}: sample value is not allowed in production`,
    );
  });

  it('production từ chối mật khẩu quản trị mẫu', () => {
    const source = {
      ...production,
      BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test',
      BOOTSTRAP_ADMIN_PASSWORD: `change-me-${'x'.repeat(12)}`,
    };
    expect(() => parseEnv(source)).toThrow('BOOTSTRAP_ADMIN_PASSWORD');
  });

  it('production từ chối mật khẩu database mẫu', () => {
    const source = {
      ...production,
      DATABASE_URL: `postgresql://user:change-me-${'x'.repeat(8)}@db/identity`,
    };
    expect(() => parseEnv(source)).toThrow('DATABASE_URL: sample value');
  });

  it('production nhận giá trị riêng', () => {
    expect(parseEnv(production).NODE_ENV).toBe('production');
  });

  it('development vẫn chạy được với giá trị mẫu', () => {
    expect(parseEnv({ ...valid, OTP_HASH_SECRET: SAMPLE_PHRASE }).NODE_ENV).toBe('development');
  });
});

describe('định dạng log', () => {
  it('development mặc định in log dễ đọc, LOG_PRETTY=false thì in JSON', () => {
    expect(new AppConfig(parseEnv(valid)).log.pretty).toBe(true);
    expect(new AppConfig(parseEnv({ ...valid, LOG_PRETTY: 'false' })).log.pretty).toBe(false);
  });
});

describe('cấu hình môi trường', () => {
  it('nhận cấu hình tối thiểu và áp giá trị mặc định', () => {
    const env = parseEnv(valid);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.OTP_DELIVERY).toBe('log');
  });

  it.each([
    'SERVICE_NAME',
    'DATABASE_URL',
    'AUTH_JWKS_URL',
    'KEY_ENCRYPTION_SECRET',
    'OTP_HASH_SECRET',
  ])('từ chối boot khi thiếu %s và nêu tên biến', (name) => {
    const source: Record<string, string | undefined> = { ...valid, [name]: undefined };
    expect(() => parseEnv(source)).toThrow(name);
  });

  it('từ chối khoá mã hoá sai độ dài và không lộ giá trị', () => {
    const source = { ...valid, KEY_ENCRYPTION_SECRET: 'hunter2' };
    expect(() => parseEnv(source)).toThrow('KEY_ENCRYPTION_SECRET');
    expect(() => parseEnv(source)).not.toThrow('hunter2');
  });

  it('không cho ghi OTP ra log ở production', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow('OTP_DELIVERY');
  });

  it('bắt buộc đủ cấu hình khi gửi OTP qua webhook', () => {
    expect(() => parseEnv({ ...valid, OTP_DELIVERY: 'webhook' })).toThrow('OTP_WEBHOOK_URL');
  });

  it('bắt buộc khai cùng lúc email và mật khẩu admin khởi tạo', () => {
    expect(() => parseEnv({ ...valid, BOOTSTRAP_ADMIN_EMAIL: 'a@b.test' })).toThrow(
      'BOOTSTRAP_ADMIN_PASSWORD',
    );
  });

  it('luôn phát token cho audience của chính service và thêm audience khai báo', () => {
    const config = new AppConfig(parseEnv({ ...valid, TOKEN_AUDIENCES: 'media,audience' }));
    expect(config.tokens.audiences).toEqual(['audience', 'media']);
  });
});
