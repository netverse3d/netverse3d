import { AppConfig } from '@app/config/app-config';
import { parseEnv } from '@app/config/env.schema';

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

  it('chỉ bật swagger ngoài production dù biến cấu hình yêu cầu bật', () => {
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production' })).swagger.enabled).toBe(
      false,
    );
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'development' })).swagger.enabled).toBe(
      true,
    );
    expect(
      new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).swagger
        .enabled,
    ).toBe(false);
  });

  it('thiếu biến bắt buộc -> báo tên biến, không kèm giá trị', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('giá trị trống được coi như chưa đặt', () => {
    expect(() =>
      parseEnv({
        SERVICE_NAME: 'svc',
        DATABASE_URL: '',
        AUTH_JWKS_URL: 'http://localhost/jwks',
        AUTH_ISSUER: 'i',
        AUTH_AUDIENCE: 'a',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('biến có giá trị -> trả về nguyên vẹn', () => {
    const env = parseEnv({
      SERVICE_NAME: 'svc',
      DATABASE_URL: 'postgresql://x',
      AUTH_JWKS_URL: 'http://localhost/jwks',
      AUTH_ISSUER: 'i',
      AUTH_AUDIENCE: 'a',
    });
    expect(env.DATABASE_URL).toBe('postgresql://x');
  });

  it('tắt log dạng đẹp khi LOG_PRETTY=false, kể cả ở development', () => {
    const config = new AppConfig(
      parseEnv({ ...valid, NODE_ENV: 'development', LOG_PRETTY: 'false' }),
    );
    expect(config.log.pretty).toBe(false);
  });

  it('mặc định bật log dạng đẹp ở development khi không khai LOG_PRETTY', () => {
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'development' })).log.pretty).toBe(true);
    expect(new AppConfig(parseEnv({ ...valid, NODE_ENV: 'production' })).log.pretty).toBe(false);
  });
});
