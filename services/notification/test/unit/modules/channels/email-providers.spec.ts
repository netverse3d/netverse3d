import { AppConfig } from '../../../../src/config/app-config';
import { parseEnv } from '../../../../src/config/env.schema';
import { createEmailSender } from '../../../../src/modules/channels/email-provider-registry';
import { EMAIL_PROVIDERS } from '../../../../src/modules/channels/email-providers';
import {
  DisabledChannelSender,
  LogChannelSender,
} from '../../../../src/modules/channels/adapters/simple-senders';

const BASE = {
  SERVICE_NAME: 'svc',
  DATABASE_URL: 'postgresql://localhost/unused',
  AUTH_JWKS_URL: 'http://localhost/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
  KAFKA_BROKERS: 'kafka:9092',
  PUSH_PROVIDER: 'none',
  EMAIL_FROM_ADDRESS: 'from@example.test',
};
const FILLED: Record<string, string> = {
  BREVO_API_KEY: 'q'.repeat(24),
  RESEND_API_KEY: 'q'.repeat(24),
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'q'.repeat(24),
  GMAIL_CLIENT_ID: 'client.apps.example.test',
  GMAIL_CLIENT_SECRET: 'q'.repeat(24),
  GMAIL_REFRESH_TOKEN: 'q'.repeat(40),
};

const envFor = (provider: string, overrides: Record<string, string | undefined> = {}) => ({
  ...BASE,
  ...FILLED,
  EMAIL_PROVIDER: provider,
  ...overrides,
});

describe('sổ đăng ký nhà cung cấp email', () => {
  it('có đủ bốn nhà cung cấp, mỗi tên chỉ đăng ký một lần', () => {
    const names = EMAIL_PROVIDERS.map((provider) => provider.name);
    expect([...names].sort()).toEqual(['brevo', 'gmail-api', 'resend', 'smtp']);
    expect(new Set(names).size).toBe(names.length);
  });

  it('hai nhà cung cấp không khai trùng tên biến môi trường', () => {
    const variables = EMAIL_PROVIDERS.flatMap((provider) => Object.keys(provider.env));
    expect(new Set(variables).size).toBe(variables.length);
  });

  it('mỗi biến bắt buộc và mỗi bí mật của nhà cung cấp đều nằm trong các biến nó khai', () => {
    for (const provider of EMAIL_PROVIDERS) {
      const declared = Object.keys(provider.env);
      expect(declared).toEqual(expect.arrayContaining([...provider.required]));
      expect(declared).toEqual(expect.arrayContaining([...provider.secrets]));
    }
  });

  it('chọn nhà cung cấp không có trong sổ thì không khởi động và nêu các tên hợp lệ', () => {
    expect(() => parseEnv(envFor('sendgrid'))).toThrow('EMAIL_PROVIDER');
    expect(() => parseEnv(envFor('sendgrid'))).toThrow('resend');
  });

  it.each(
    EMAIL_PROVIDERS.flatMap((provider) => provider.required.map((name) => [provider.name, name])),
  )('chọn %s mà thiếu %s thì không khởi động', (provider, name) => {
    expect(() => parseEnv(envFor(provider, { [name]: undefined }))).toThrow(name);
  });

  it.each(EMAIL_PROVIDERS.map((provider) => [provider.name]))(
    'chọn %s mà thiếu địa chỉ người gửi thì không khởi động',
    (provider) => {
      expect(() => parseEnv(envFor(provider, { EMAIL_FROM_ADDRESS: undefined }))).toThrow(
        'EMAIL_FROM_ADDRESS',
      );
    },
  );

  it.each(
    EMAIL_PROVIDERS.flatMap((provider) => provider.secrets.map((name) => [provider.name, name])),
  )('production với %s từ chối giá trị mẫu ở %s', (provider, name) => {
    const source = envFor(provider, {
      NODE_ENV: 'production',
      [name]: `change-me-${'x'.repeat(12)}`,
    });
    expect(() => parseEnv(source)).toThrow(`${name}: sample value is not allowed in production`);
  });

  it('biến của nhà cung cấp không được chọn có thể bỏ trống', () => {
    const source = { ...BASE, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: FILLED.RESEND_API_KEY };
    expect(parseEnv(source).EMAIL_PROVIDER).toBe('resend');
  });

  it.each(EMAIL_PROVIDERS.map((provider) => [provider.name]))(
    'tạo được bộ gửi cho %s từ cấu hình hợp lệ',
    (provider) => {
      const sender = createEmailSender(new AppConfig(parseEnv(envFor(provider))));
      expect(sender).not.toBeInstanceOf(LogChannelSender);
      expect(sender).not.toBeInstanceOf(DisabledChannelSender);
      expect(typeof sender.send).toBe('function');
    },
  );

  it('SMTP khai tài khoản mà thiếu mật khẩu, hoặc ngược lại, thì không khởi động', () => {
    expect(() => parseEnv(envFor('smtp', { SMTP_PASSWORD: undefined }))).toThrow('SMTP_PASSWORD');
    expect(() => parseEnv(envFor('smtp', { SMTP_USER: undefined }))).toThrow('SMTP_USER');
  });

  it('SMTP không xác thực vẫn chạy, cho hộp thư giả lập ở dev', () => {
    const source = envFor('smtp', { SMTP_USER: undefined, SMTP_PASSWORD: undefined });
    expect(parseEnv(source).EMAIL_SETTINGS).toMatchObject({ SMTP_HOST: 'smtp.example.test' });
  });

  it('cấu hình thiếu nhà cung cấp hoặc người gửi không âm thầm tắt kênh email', () => {
    const config = new AppConfig(parseEnv(envFor('resend')));
    const broken = { ...config, email: { ...config.email, fromAddress: undefined } } as AppConfig;
    expect(() => createEmailSender(broken)).toThrow('EMAIL_FROM_ADDRESS');
    const unknown = { ...config, email: { ...config.email, provider: 'sendgrid' } } as AppConfig;
    expect(() => createEmailSender(unknown)).toThrow('sendgrid');
  });

  it('log và none không thuộc nhà cung cấp nào và vẫn dùng được', () => {
    expect(
      createEmailSender(new AppConfig(parseEnv({ ...BASE, EMAIL_PROVIDER: 'log' }))),
    ).toBeInstanceOf(LogChannelSender);
    expect(
      createEmailSender(new AppConfig(parseEnv({ ...BASE, EMAIL_PROVIDER: 'none' }))),
    ).toBeInstanceOf(DisabledChannelSender);
  });
});
