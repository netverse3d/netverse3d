import { AppConfig } from '../../../src/config/app-config';
import { parseEnv } from '../../../src/config/env.schema';

const valid = {
  SERVICE_NAME: 'svc',
  DATABASE_URL: 'postgresql://user:hunter2@localhost/db',
  AUTH_JWKS_URL: 'http://localhost:4000/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
};

describe('cấu hình môi trường', () => {
  it('nhận cấu hình tối thiểu và áp giá trị mặc định', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.RATE_LIMIT_MAX).toBe(120);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it.each(['SERVICE_NAME', 'DATABASE_URL', 'AUTH_JWKS_URL', 'AUTH_ISSUER', 'AUTH_AUDIENCE'])(
    'từ chối boot khi thiếu %s và nêu tên biến',
    (name) => {
      const source: Record<string, string | undefined> = { ...valid, [name]: undefined };
      expect(() => parseEnv(source)).toThrow(name);
    },
  );

  it('không để lộ giá trị biến trong thông báo lỗi', () => {
    const source = { ...valid, AUTH_JWKS_URL: 'not-a-url-hunter2' };
    expect(() => parseEnv(source)).toThrow('AUTH_JWKS_URL');
    expect(() => parseEnv(source)).not.toThrow('hunter2');
  });

  it('tách danh sách origin theo dấu phẩy và bỏ phần trống', () => {
    const env = parseEnv({ ...valid, CORS_ORIGINS: 'https://a.test, ,https://b.test' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.test', 'https://b.test']);
  });

  it('tắt swagger mặc định ở production, bật được khi khai rõ', () => {
    const production = {
      ...valid,
      NODE_ENV: 'production',
      EMAIL_PROVIDER: 'none',
      PUSH_PROVIDER: 'none',
    };
    expect(new AppConfig(parseEnv(production)).swagger.enabled).toBe(false);
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'development' })).swagger.enabled).toBe(
      true,
    );
    expect(
      new AppConfig(parseEnv({ ...production, SWAGGER_ENABLED: 'true' })).swagger.enabled,
    ).toBe(true);
  });
});

describe('cấu hình kênh gửi và sự kiện', () => {
  const production = { ...valid, NODE_ENV: 'production', PUSH_PROVIDER: 'none' };

  it('coi biến trống như chưa khai', () => {
    const env = parseEnv({ ...valid, EMAIL_PROVIDER: '', BREVO_API_KEY: '' });
    expect(env.EMAIL_PROVIDER).toBe('log');
    expect(env.BREVO_API_KEY).toBeUndefined();
  });

  it('từ chối boot ở production khi email cấu hình là log, kể cả mặc định', () => {
    expect(() => parseEnv(production)).toThrow('EMAIL_PROVIDER');
    expect(() => parseEnv({ ...production, EMAIL_PROVIDER: 'log' })).toThrow('EMAIL_PROVIDER');
  });

  it('từ chối boot ở production khi push cấu hình là log', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'production', EMAIL_PROVIDER: 'none' })).toThrow(
      'PUSH_PROVIDER',
    );
  });

  it('cho phép production khi tắt kênh hoặc dùng nhà cung cấp thật', () => {
    expect(parseEnv({ ...production, EMAIL_PROVIDER: 'none' }).EMAIL_PROVIDER).toBe('none');
    expect(
      parseEnv({
        ...production,
        EMAIL_PROVIDER: 'brevo',
        BREVO_API_KEY: 'k',
        EMAIL_FROM_ADDRESS: 'a@b.test',
      }).EMAIL_PROVIDER,
    ).toBe('brevo');
  });

  it.each([
    [{ EMAIL_PROVIDER: 'brevo' }, 'BREVO_API_KEY'],
    [{ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' }, 'EMAIL_FROM_ADDRESS'],
    [{ PUSH_PROVIDER: 'firebase' }, 'FIREBASE_PROJECT_ID'],
  ])('bắt buộc đủ cấu hình của nhà cung cấp đã chọn %#', (partial, missing) => {
    expect(() => parseEnv({ ...valid, ...partial })).toThrow(missing);
  });

  it('mặc định không bật RabbitMQ', () => {
    expect(parseEnv(valid).EVENT_TRANSPORT).toBe('none');
  });

  it('từ chối lô gửi có thể chạy lâu hơn thời hạn giữ chỗ', () => {
    expect(() =>
      parseEnv({ ...valid, DELIVERY_BATCH_SIZE: '1000', DELIVERY_CONCURRENCY: '1' }),
    ).toThrow('DELIVERY_BATCH_SIZE');
  });
});
