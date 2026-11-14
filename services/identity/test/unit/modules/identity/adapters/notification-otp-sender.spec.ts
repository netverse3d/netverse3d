import type { CommandCallOptions, CommandClient } from '@netverse/nest-kit';
import { parseEnv } from '../../../../../src/config/env.schema';
import { NotificationOtpSender } from '../../../../../src/modules/identity/adapters/notification-otp-sender';
import type { OtpMessage } from '../../../../../src/modules/identity/ports/otp-sender';

interface RecordedCall {
  method: string;
  request: Record<string, unknown>;
  options: CommandCallOptions;
}

class FakeCommands implements CommandClient {
  readonly calls: RecordedCall[] = [];
  failure: Error | null = null;

  call<Reply>(method: string, request: object, options: CommandCallOptions): Promise<Reply> {
    this.calls.push({ method, request: request as Record<string, unknown>, options });
    return this.failure ? Promise.reject(this.failure) : Promise.resolve({} as Reply);
  }

  close(): void {
    this.calls.length = 0;
  }
}

const EXPIRES_AT = new Date('2030-01-01T10:10:00.000Z');
const message: OtpMessage = {
  email: 'lan@example.test',
  purpose: 'EMAIL_VERIFICATION',
  code: '123456',
  expiresInMinutes: 10,
  expiresAt: EXPIRES_AT,
};

describe('gửi mã một lần qua notification', () => {
  let now: number;
  let issued: number;
  let commands: FakeCommands;
  let sender: NotificationOtpSender;

  beforeEach(() => {
    now = 1_900_000_000_000;
    issued = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    commands = new FakeCommands();
    sender = new NotificationOtpSender(commands, () => {
      issued += 1;
      return Promise.resolve({ value: `token-${issued}`, expiresAt: now + 300_000 });
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('gọi lệnh gửi ở phạm vi nền tảng, chỉ qua email, với hạn bằng hạn của mã', async () => {
    await sender.send(message);
    const [call] = commands.calls;
    expect(call?.method).toBe('Send');
    expect(call?.request).toEqual({
      scope: 'platform',
      eventType: 'identity.otp.email_verification',
      recipient: { email: 'lan@example.test' },
      variablesJson: JSON.stringify({ code: '123456', expiresInMinutes: 10 }),
      channels: ['CHANNEL_EMAIL'],
      expiresAt: '2030-01-01T10:10:00.000Z',
    });
    expect(call?.options.token).toBe('token-1');
    expect(call?.options.timeoutMs).toBeGreaterThan(0);
  });

  it('mỗi mã một khoá chống trùng riêng, để mã gửi lại không bị coi là lệnh cũ', async () => {
    await sender.send(message);
    await sender.send({ ...message, code: '654321' });
    const keys = commands.calls.map((call) => call.options.idempotencyKey);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('đặt lại mật khẩu dùng loại sự kiện riêng', async () => {
    await sender.send({ ...message, purpose: 'PASSWORD_RESET' });
    expect(commands.calls[0]?.request.eventType).toBe('identity.otp.password_reset');
  });

  it('dùng lại token của mình tới lúc gần hết hạn rồi mới ký token mới', async () => {
    await sender.send(message);
    now += 200_000;
    await sender.send(message);
    expect(issued).toBe(1);
    now += 90_000;
    await sender.send(message);
    expect(issued).toBe(2);
    expect(commands.calls[2]?.options.token).toBe('token-2');
  });

  it('notification từ chối thì báo lỗi ra ngoài, và mã không nằm trong thông báo lỗi', async () => {
    commands.failure = new Error('UNAVAILABLE');
    const failure = await sender.send(message).catch((error: unknown) => error as Error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain('123456');
  });
});

describe('cấu hình gửi mã qua notification', () => {
  const base = {
    SERVICE_NAME: 'identity',
    DATABASE_URL: 'postgresql://localhost/unused',
    AUTH_ISSUER: 'http://identity',
    AUTH_JWKS_URL: 'http://identity/.well-known/jwks.json',
    AUTH_AUDIENCE: 'identity',
    KEY_ENCRYPTION_SECRET: 'a'.repeat(64),
    OTP_HASH_SECRET: 'b'.repeat(32),
  };

  it('chọn gửi qua notification mà thiếu địa chỉ thì không khởi động', () => {
    expect(() => parseEnv({ ...base, OTP_DELIVERY: 'notification' })).toThrow(
      'OTP_NOTIFICATION_ADDRESS',
    );
  });

  it('đủ địa chỉ thì nhận', () => {
    const env = parseEnv({
      ...base,
      OTP_DELIVERY: 'notification',
      OTP_NOTIFICATION_ADDRESS: 'notification:50051',
    });
    expect(env.OTP_NOTIFICATION_ADDRESS).toBe('notification:50051');
  });
});
