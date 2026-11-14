import { randomUUID } from 'node:crypto';
import { InvalidEventError, PLATFORM_SCOPE } from '@netverse/nest-kit';
import { Scenario } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

const WELCOME = 'account.welcome';

describe('nhận sự kiện từ hàng đợi', () => {
  let subject: TestApp;
  let scenario: Scenario;
  let platformAdmin: string;

  beforeAll(async () => {
    subject = await createTestApp();
    scenario = await Scenario.start(subject);
    platformAdmin = await subject.tokens.sign({ subject: 'root', roles: ['platform_admin'] });
    const created = await scenario
      .http()
      .post('/v1/templates')
      .set('authorization', `Bearer ${platformAdmin}`)
      .send({
        eventType: WELCOME,
        channel: 'IN_APP',
        locale: 'en',
        subject: 'Welcome',
        body: 'Glad you are here',
      });
    expect([201, 409]).toContain(created.status);
  });

  beforeEach(() => {
    subject.events.healthy = true;
  });

  afterAll(() => subject.close());

  function emailVerified(overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      type: 'user.email-verified',
      source: 'identity',
      occurredAt: new Date().toISOString(),
      version: 1,
      data: { principalId: randomUUID(), tenantId: null, status: 'ACTIVE' },
      ...overrides,
    };
  }

  const welcomesFor = (principalId: string) =>
    scenario.prisma.notification.findMany({
      where: { recipientSubject: principalId },
      include: { deliveries: true },
    });

  it('tài khoản xác minh email xong thì nhận thông báo chào ở phạm vi nền tảng', async () => {
    const event = emailVerified();
    await subject.events.deliver(event);
    await scenario.drain();

    const [welcome, ...others] = await welcomesFor(event.data.principalId);
    expect(others).toEqual([]);
    expect(welcome).toMatchObject({
      tenantId: PLATFORM_SCOPE,
      source: 'EVENT',
      eventType: WELCOME,
      recipientEmail: null,
    });
    expect(welcome?.deliveries).toMatchObject([{ channel: 'IN_APP', status: 'SENT' }]);

    const player = await subject.tokens.sign({ subject: event.data.principalId, roles: [] });
    const inbox = await scenario
      .http()
      .get('/v1/inbox')
      .set('authorization', `Bearer ${player}`)
      .expect(200);
    expect(inbox.body.result.content).toMatchObject([{ title: 'Welcome' }]);
  });

  it('sự kiện tới hai lần chỉ sinh một thông báo', async () => {
    const event = emailVerified();
    await subject.events.deliver(event);
    await subject.events.deliver(event);
    expect(await welcomesFor(event.data.principalId)).toHaveLength(1);
  });

  it('cùng mã sự kiện nhưng nội dung khác bị coi là thông điệp độc', async () => {
    const event = emailVerified();
    await subject.events.deliver(event);
    const forged = { ...event, data: { ...event.data, principalId: randomUUID() } };
    await expect(subject.events.deliver(forged)).rejects.toBeInstanceOf(InvalidEventError);
    expect(await welcomesFor(forged.data.principalId)).toHaveLength(0);
  });

  it('sự kiện hợp lệ mà notification không phản ứng thì được bỏ qua, không sinh gì', async () => {
    const event = emailVerified({ type: 'user.registered' });
    await subject.events.deliver(event);
    expect(await welcomesFor(event.data.principalId)).toHaveLength(0);
  });

  it('mã sự kiện và khoá chống trùng của API là hai không gian riêng', async () => {
    const event = emailVerified();
    await subject.events.deliver(event);
    await scenario
      .http()
      .post('/v1/notifications')
      .set('authorization', `Bearer ${platformAdmin}`)
      .set('idempotency-key', event.id)
      .send({ eventType: WELCOME, recipient: { subject: randomUUID() } })
      .expect(201);
  });

  it.each([
    ['không phải JSON', Buffer.from('{oops')],
    ['không phải vỏ sự kiện', Buffer.from(JSON.stringify(['x']))],
    ['thiếu nguồn', Buffer.from(JSON.stringify({ id: randomUUID(), type: 'user.registered' }))],
  ])('thông điệp %s bị từ chối là thông điệp độc', async (_name, payload) => {
    await expect(subject.events.deliverRaw(payload)).rejects.toBeInstanceOf(InvalidEventError);
  });

  it.each([
    ['từ nguồn notification không nghe', { source: 'payments' }],
    ['có loại không khai trong hợp đồng', { type: 'user.promoted' }],
    ['thiếu mã tài khoản', { data: { tenantId: null } }],
    [
      'mang trường lạ như email',
      { data: { principalId: randomUUID(), tenantId: null, email: 'a@example.test' } },
    ],
    ['sai phiên bản vỏ', { version: 'one' }],
  ])('sự kiện %s bị từ chối theo hợp đồng', async (_name, overrides) => {
    await expect(subject.events.deliver(emailVerified(overrides))).rejects.toBeInstanceOf(
      InvalidEventError,
    );
  });

  it('lỗi hạ tầng không bị coi là thông điệp độc, để sự kiện được giao lại', async () => {
    const spy = jest
      .spyOn(scenario.prisma.notification, 'create')
      .mockRejectedValueOnce(new Error('connection lost'));
    const event = emailVerified();
    const failure = await subject.events.deliver(event).catch((error: unknown) => error);
    spy.mockRestore();
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(InvalidEventError);

    await subject.events.deliver(event);
    expect(await welcomesFor(event.data.principalId)).toHaveLength(1);
  });

  it('healthz báo 503 khi transport sự kiện mất kết nối', async () => {
    subject.events.healthy = false;
    const { body } = await scenario.http().get('/healthz').expect(503);
    expect(body.code).toBe('COMMON.SERVICE_UNAVAILABLE');
    subject.events.healthy = true;
    await scenario.http().get('/healthz').expect(200);
  });
});
