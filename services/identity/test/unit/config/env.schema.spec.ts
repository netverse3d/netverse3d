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
