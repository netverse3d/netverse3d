import { exportPKCS8, generateKeyPair } from 'jose';
import { AppConfig } from '../../../../../src/config/app-config';
import { parseEnv } from '../../../../../src/config/env.schema';
import {
  OutboundMessage,
  PermanentSendError,
  ProviderConfigurationError,
} from '../../../../../src/modules/channels/ports/channel-sender';
import { FirebasePushSender } from '../../../../../src/modules/channels/adapters/firebase-push-sender';

const KEY_GENERATION_TIMEOUT_MS = 60_000;

const BASE_ENV = {
  SERVICE_NAME: 'svc',
  DATABASE_URL: 'postgresql://localhost/unused',
  AUTH_JWKS_URL: 'http://localhost/jwks.json',
  AUTH_ISSUER: 'issuer',
  AUTH_AUDIENCE: 'audience',
};

const message: OutboundMessage = {
  deliveryId: 'delivery-1',
  tenantId: 'tenant-a',
  eventType: 'account.welcome',
  channel: 'EMAIL',
  destination: 'user@example.test',
  subject: 'Subject',
  body: '<p>Body</p>',
};

describe('gửi push qua Firebase', () => {
  let sender: FirebasePushSender;
  let config: AppConfig;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair('RS256', { extractable: true });
    config = new AppConfig(
      parseEnv({
        ...BASE_ENV,
        PUSH_PROVIDER: 'firebase',
        FIREBASE_PROJECT_ID: 'project-1',
        FIREBASE_CLIENT_EMAIL: 'svc@project-1.test',
        FIREBASE_PRIVATE_KEY: (await exportPKCS8(privateKey)).replace(/\n/g, '\\n'),
      }),
    );
    sender = new FirebasePushSender(config);
  }, KEY_GENERATION_TIMEOUT_MS);

  afterEach(() => jest.restoreAllMocks());

  function mockFirebase(
    sendStatus: number,
    sendBody: unknown = {},
    tokenStatus = 200,
  ): jest.SpyInstance {
    return jest
      .spyOn(global, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          String(input).includes('oauth2')
            ? new Response(
                JSON.stringify({ access_token: 'access-token-value', expires_in: 3600 }),
                { status: tokenStatus },
              )
            : new Response(JSON.stringify(sendBody), { status: sendStatus }),
        ),
      );
  }

  const pushMessage = { ...message, channel: 'PUSH' as const, destination: 'device-token-1' };

  it('lấy token rồi gửi đúng thiết bị và tái dùng token đã có', async () => {
    const fetchMock = mockFirebase(200, { name: 'projects/project-1/messages/1' });
    await expect(sender.send(pushMessage)).resolves.toEqual({
      providerMessageId: 'projects/project-1/messages/1',
    });
    const sendCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('messages:send'),
    ) as [string, RequestInit];
    expect(sendCall[0]).toBe('https://fcm.googleapis.com/v1/projects/project-1/messages:send');
    expect((sendCall[1].headers as Record<string, string>).authorization).toBe(
      'Bearer access-token-value',
    );
    expect(JSON.parse(sendCall[1].body as string).message.token).toBe('device-token-1');

    await sender.send(pushMessage);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2'))).toHaveLength(1);
  });

  it('coi token thiết bị không còn hiệu lực là lỗi vĩnh viễn', async () => {
    mockFirebase(404);
    await expect(sender.send(pushMessage)).rejects.toBeInstanceOf(PermanentSendError);
  });

  it('khoá bị từ chối là lỗi cấu hình: thử lại, và bỏ token đang giữ', async () => {
    mockFirebase(200, { name: 'n' });
    await sender.send(pushMessage);
    jest.restoreAllMocks();
    mockFirebase(401);
    await expect(sender.send(pushMessage)).rejects.toBeInstanceOf(ProviderConfigurationError);
    jest.restoreAllMocks();
    const fetchMock = mockFirebase(200, { name: 'n' });
    await Promise.all([sender.send(pushMessage), sender.send(pushMessage)]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2'))).toHaveLength(1);
  });

  it('Google không cấp token vì khoá service account sai là lỗi cấu hình', async () => {
    const fresh = new FirebasePushSender(config);
    mockFirebase(200, {}, 401);
    await expect(fresh.send(pushMessage)).rejects.toBeInstanceOf(ProviderConfigurationError);
  });

  it('lỗi 403 lúc gửi có thể do riêng thiết bị, nên là lỗi thường chứ không báo sai cấu hình', async () => {
    mockFirebase(403);
    const attempt = sender.send(pushMessage);
    await expect(attempt).rejects.not.toBeInstanceOf(ProviderConfigurationError);
    await expect(attempt).rejects.not.toBeInstanceOf(PermanentSendError);
  });

  it('coi lỗi 503 là tạm thời', async () => {
    mockFirebase(503);
    await expect(sender.send(pushMessage)).rejects.not.toBeInstanceOf(PermanentSendError);
  });
});
