import { randomUUID } from 'node:crypto';
import { status as GrpcStatus } from '@grpc/grpc-js';
import {
  CommandClient,
  connectCommands,
  GrpcCallError,
  GrpcServer,
  loadContract,
} from '@netverse/nest-kit';
import type { SendReply__Output } from '../src/generated/grpc/netverse/notification/v1/SendReply';
import type { SendRequest } from '../src/generated/grpc/netverse/notification/v1/SendRequest';
import { Scenario } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

const SERVICE = 'netverse.notification.v1.NotificationCommands';
const PERMISSION = 'notification:send';

describe('lệnh gửi thông báo qua gRPC', () => {
  let subject: TestApp;
  let scenario: Scenario;
  let commands: CommandClient;
  let eventType: string;

  beforeAll(async () => {
    subject = await createTestApp({ GRPC_PORT: '0' });
    const { port } = subject.app.get(GrpcServer);
    commands = connectCommands(loadContract('notification'), SERVICE, `127.0.0.1:${port}`);
  });

  beforeEach(async () => {
    scenario = await Scenario.start(subject);
    eventType = `event.${randomUUID()}`;
    await scenario.createTemplate({
      eventType,
      channel: 'IN_APP',
      subject: 'Hello {{name}}',
      body: 'Body',
    });
  });

  afterAll(async () => {
    commands.close();
    await subject.close();
  });

  const serviceToken = (permissions: string[] = [PERMISSION]) =>
    subject.tokens.sign({ subject: 'service:shop', clientId: 'shop', permissions });

  const request = (overrides: SendRequest = {}): SendRequest => ({
    scope: scenario.tenantId,
    eventType,
    recipient: { subject: 'user-1' },
    variablesJson: JSON.stringify({ name: 'Lan' }),
    channels: ['CHANNEL_IN_APP'],
    ...overrides,
  });

  const send = async (body: SendRequest, key: string = randomUUID(), token?: string) =>
    commands.call<SendReply__Output>('Send', body, {
      token: token ?? (await serviceToken()),
      idempotencyKey: key,
      timeoutMs: 10_000,
    });

  const failure = async (attempt: Promise<unknown>): Promise<GrpcCallError> => {
    try {
      await attempt;
    } catch (error) {
      return error as GrpcCallError;
    }
    throw new Error('the call was expected to fail');
  };

  it('service có quyền gửi được thông báo vào hộp thư của người nhận trong tiệm nêu ở lệnh', async () => {
    const reply = await send(request());
    expect(reply.notificationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reply.deliveries).toEqual([
      { id: expect.any(String), channel: 'CHANNEL_IN_APP', status: 'PENDING' },
    ]);

    await scenario.drain();
    const inbox = await scenario
      .http()
      .get('/v1/inbox')
      .set('authorization', `Bearer ${await scenario.userToken('user-1')}`)
      .expect(200);
    expect(inbox.body.result.content[0]).toMatchObject({ eventType, title: 'Hello Lan' });
  });

  it('gọi lại cùng khoá chống trùng trả đúng thông báo cũ, không tạo thêm', async () => {
    const key = randomUUID();
    const first = await send(request(), key);
    const second = await send(request(), key);
    expect(second.notificationId).toBe(first.notificationId);
    expect(
      await scenario.prisma.notification.count({
        where: { tenantId: scenario.tenantId, eventType },
      }),
    ).toBe(1);
  });

  it('cùng khoá nhưng khác nội dung bị từ chối kèm mã lỗi của ứng dụng', async () => {
    const key = randomUUID();
    await send(request(), key);
    const error = await failure(send(request({ recipient: { subject: 'user-2' } }), key));
    expect(error.status).toBe(GrpcStatus.FAILED_PRECONDITION);
    expect(error.errorCode).toBe('NOTIFICATION.IDEMPOTENCY_KEY_REUSED');
  });

  it('khoá của service không đụng khoá cùng tên mà quản trị tiệm dùng qua HTTP', async () => {
    const key = randomUUID();
    const viaHttp = await scenario
      .http()
      .post('/v1/notifications')
      .set('authorization', `Bearer ${scenario.admin}`)
      .set('idempotency-key', key)
      .send({ eventType, recipient: { subject: 'user-9' }, channels: ['IN_APP'] });
    expect([200, 201, 202]).toContain(viaHttp.status);
    const viaGrpc = await send(request(), key);
    expect(viaGrpc.notificationId).not.toBe(viaHttp.body.result.id);
  });

  it('token của người dùng bị từ chối, kể cả quản trị của chính tiệm đó', async () => {
    const error = await failure(send(request(), randomUUID(), scenario.admin));
    expect(error.status).toBe(GrpcStatus.PERMISSION_DENIED);
  });

  it('service không có quyền gửi bị từ chối', async () => {
    const token = await serviceToken(['media:read']);
    const error = await failure(send(request(), randomUUID(), token));
    expect(error.status).toBe(GrpcStatus.PERMISSION_DENIED);
  });

  it('lệnh thiếu phạm vi bị từ chối, service không được suy phạm vi ngầm', async () => {
    const error = await failure(send(request({ scope: '' })));
    expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
    expect(error.errorCode).toBe('NOTIFICATION.SCOPE_REQUIRED');
  });

  it('phạm vi nền tảng chưa được hỗ trợ ở đợt này và bị từ chối rõ ràng', async () => {
    const error = await failure(send(request({ scope: 'platform' })));
    expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
    expect(error.errorCode).toBe('NOTIFICATION.SCOPE_REQUIRED');
  });

  it('nội dung sai dạng bị từ chối theo cùng luật với HTTP', async () => {
    const error = await failure(send(request({ eventType: 'Not An Event' })));
    expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
    expect(error.errorCode).toBe('COMMON.VALIDATION');
  });

  it.each(['not json', '[1,2]', '"text"'])(
    'biến %s không phải một đối tượng JSON bị từ chối',
    async (variablesJson) => {
      const error = await failure(send(request({ variablesJson })));
      expect(error.status).toBe(GrpcStatus.INVALID_ARGUMENT);
      expect(error.errorCode).toBe('COMMON.VALIDATION');
    },
  );

  it('không nêu kênh thì service tự chọn kênh như đường HTTP', async () => {
    const reply = await send(request({ channels: [] }));
    expect(reply.deliveries.map((delivery) => delivery.channel)).toEqual(['CHANNEL_IN_APP']);
  });

  it('healthz báo khoẻ lúc máy chủ gRPC đang phục vụ', async () => {
    await scenario.http().get('/healthz').expect(200);
  });
});
