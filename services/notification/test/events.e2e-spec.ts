import { randomUUID } from 'node:crypto';
import { InvalidEventError } from '@netverse/nest-kit';
import { Scenario, uniqueEvent } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

describe('nhận sự kiện từ hàng đợi', () => {
  let subject: TestApp;
  let scenario: Scenario;

  beforeAll(async () => {
    subject = await createTestApp();
  });

  beforeEach(async () => {
    subject.email.reset();
    subject.events.healthy = true;
    scenario = await Scenario.start(subject);
  });

  afterAll(() => subject.close());

  function event(eventType: string, overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      tenantId: scenario.tenantId,
      eventType,
      recipient: { email: 'user@example.test' },
      variables: { name: 'Lan' },
      ...overrides,
    };
  }

  it('sự kiện có template đi cùng đường với API và được gửi', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType });
    await subject.events.deliver(event(eventType));
    await scenario.drain();
    expect(subject.email.forEvent(eventType)).toEqual([
      expect.objectContaining({ body: '<p>Hello Lan</p>' }),
    ]);
    const notification = await scenario.prisma.notification.findFirstOrThrow({
      where: { eventType },
    });
    expect(notification.source).toBe('EVENT');
  });

  it('sự kiện lạ không có template vào dead có lý do, không mất', async () => {
    const eventType = uniqueEvent();
    await subject.events.deliver(event(eventType));
    await scenario.drain();
    expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
      status: 'DEAD',
      reason: 'TEMPLATE_NOT_FOUND',
    });
  });

  it('sự kiện lặp lại chỉ tạo một lần gửi', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType });
    const message = event(eventType);
    await subject.events.deliver(message);
    await subject.events.deliver(message);
    await scenario.drain();
    expect(await scenario.deliveriesOf(eventType)).toHaveLength(1);
    expect(subject.email.forEvent(eventType)).toHaveLength(1);
  });

  it('khoá của sự kiện và khoá của API là hai không gian riêng', async () => {
    const eventType = uniqueEvent();
    const message = event(eventType);
    await subject.events.deliver(message);
    const response = await scenario.send(
      { eventType, recipient: { email: 'other@example.test' } },
      message.id,
    );
    expect(response.status).toBe(201);
  });

  it('sự kiện lặp id nhưng khác nội dung bị coi là thông điệp độc', async () => {
    const eventType = uniqueEvent();
    const message = event(eventType);
    await subject.events.deliver(message);
    await expect(
      subject.events.deliver({ ...message, variables: { name: 'Other' } }),
    ).rejects.toBeInstanceOf(InvalidEventError);
    expect(await scenario.deliveriesOf(eventType)).toHaveLength(1);
  });

  it.each([
    ['không phải JSON', Buffer.from('{oops')],
    ['thiếu trường bắt buộc', Buffer.from(JSON.stringify({ id: 'x' }))],
    [
      'người nhận rỗng',
      Buffer.from(JSON.stringify({ id: 'x', tenantId: 't', eventType: 'a.b', recipient: {} })),
    ],
  ])('thông điệp %s bị từ chối là thông điệp độc', async (_name, payload) => {
    await expect(subject.events.deliverRaw(payload)).rejects.toBeInstanceOf(InvalidEventError);
  });

  it('lỗi hạ tầng không bị coi là thông điệp độc', async () => {
    const prisma = scenario.prisma;
    const spy = jest
      .spyOn(prisma.notification, 'create')
      .mockRejectedValueOnce(new Error('connection lost'));
    await expect(subject.events.deliver(event(uniqueEvent()))).rejects.not.toBeInstanceOf(
      InvalidEventError,
    );
    spy.mockRestore();
  });

  it('sự kiện chỉ ghi vào đúng tenant của nó', async () => {
    const eventType = uniqueEvent();
    const other = await Scenario.start(subject);
    await subject.events.deliver(event(eventType, { tenantId: other.tenantId }));
    expect(await scenario.deliveriesOf(eventType)).toHaveLength(0);
    expect(await other.deliveriesOf(eventType)).toHaveLength(1);
  });

  it('healthz báo 503 khi transport sự kiện mất kết nối', async () => {
    subject.events.healthy = false;
    const { body } = await scenario.http().get('/healthz').expect(503);
    expect(body.code).toBe('COMMON.SERVICE_UNAVAILABLE');
    subject.events.healthy = true;
    await scenario.http().get('/healthz').expect(200);
  });
});
