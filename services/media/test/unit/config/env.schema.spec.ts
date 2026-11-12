import { AppConfig } from '../../../src/config/app-config';
import { parseEnv } from '../../../src/config/env.schema';

const valid = {
  SERVICE_NAME: 'svc',
  DATABASE_URL: 'postgresql://user:hunter2@localhost/db',
  AUTH_JWKS_URL: 'http://localhost:4000/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
  S3_ENDPOINT: 's3.internal',
  S3_PORT: '9000',
  S3_ACCESS_KEY: 'access',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET_PRIVATE: 'media-private',
  S3_BUCKET_INTERNAL: 'media-internal',
  S3_BUCKET_PUBLIC: 'media-public',
  S3_BUCKET_TEMP: 'media-temp',
};

const SAMPLE_PHRASE = `change-me-${'x'.repeat(12)}`;

describe('giá trị mẫu ở production', () => {
  it('production từ chối boot khi khoá của kho là giá trị mẫu', () => {
    const source = { ...valid, NODE_ENV: 'production', S3_SECRET_KEY: SAMPLE_PHRASE };
    expect(() => parseEnv(source)).toThrow(
      'S3_SECRET_KEY: sample value is not allowed in production',
    );
  });

  it('production từ chối mật khẩu database mẫu', () => {
    const source = {
      ...valid,
      NODE_ENV: 'production',
      S3_SECRET_KEY: 'q'.repeat(24),
      DATABASE_URL: `postgresql://user:change-me-${'x'.repeat(8)}@db/media`,
    };
    expect(() => parseEnv(source)).toThrow('DATABASE_URL: sample value');
  });

  it('production nhận giá trị riêng', () => {
    const source = { ...valid, NODE_ENV: 'production', S3_SECRET_KEY: 'q'.repeat(24) };
    expect(parseEnv(source).NODE_ENV).toBe('production');
  });

  it('development vẫn chạy được với giá trị mẫu', () => {
    expect(parseEnv({ ...valid, S3_SECRET_KEY: SAMPLE_PHRASE }).NODE_ENV).toBe('development');
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
    expect(env.PORT).toBe(3000);
    expect(env.RATE_LIMIT_MAX).toBe(120);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it.each([
    'SERVICE_NAME',
    'DATABASE_URL',
    'AUTH_JWKS_URL',
    'AUTH_ISSUER',
    'AUTH_AUDIENCE',
    'S3_ENDPOINT',
    'S3_SECRET_KEY',
    'S3_BUCKET_TEMP',
  ])('từ chối boot khi thiếu %s và nêu tên biến', (name) => {
    const source: Record<string, string | undefined> = { ...valid, [name]: undefined };
    expect(() => parseEnv(source)).toThrow(name);
  });

  it('không để lộ giá trị biến trong thông báo lỗi', () => {
    const source = { ...valid, AUTH_JWKS_URL: 'not-a-url-hunter2' };
    expect(() => parseEnv(source)).toThrow('AUTH_JWKS_URL');
    expect(() => parseEnv(source)).not.toThrow('hunter2');
  });

  it('tắt swagger mặc định ở production, bật được khi khai rõ', () => {
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production' })).swagger.enabled).toBe(
      false,
    );
    expect(
      new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).swagger
        .enabled,
    ).toBe(true);
  });

  it('dùng endpoint nội bộ làm endpoint công khai khi không khai riêng', () => {
    expect(new AppConfig(parseEnv(valid)).storage.public).toEqual({
      endPoint: 's3.internal',
      port: 9000,
      useSSL: false,
    });
  });

  it('tách endpoint công khai cho URL ký sẵn', () => {
    const config = new AppConfig(
      parseEnv({
        ...valid,
        S3_PUBLIC_ENDPOINT: 'cdn.example.test',
        S3_PUBLIC_PORT: '443',
        S3_PUBLIC_USE_SSL: 'true',
      }),
    );
    expect(config.storage.public).toEqual({
      endPoint: 'cdn.example.test',
      port: 443,
      useSSL: true,
    });
    expect(config.storage.internal.endPoint).toBe('s3.internal');
  });

  it('chuẩn hoá danh sách định dạng về chữ thường', () => {
    const config = new AppConfig(
      parseEnv({ ...valid, MEDIA_USER_CONTENT_ALLOWED_TYPES: 'Image/PNG, audio/*' }),
    );
    expect(config.media.userContent.allowedTypes).toEqual(['image/png', 'audio/*']);
  });
});
