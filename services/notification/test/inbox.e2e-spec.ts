import { randomUUID } from 'node:crypto';
import { Scenario, uniqueEvent } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

describe('hộp thư trong ứng dụng', () => {
  let subject: TestApp;
  let scenario: Scenario;
  let eventType: string;

  const bearer = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    subject = await createTestApp();
  });

  beforeEach(async () => {
    scenario = await Scenario.start(subject);
    eventType = uniqueEvent();
    await scenario.createTemplate({
      eventType,
      channel: 'IN_APP',
      subject: 'Title {{n}}',
      body: 'Body {{n}}',
    });
  });

  afterAll(() => subject.close());

  async function deliverTo(
    target: Scenario,
    recipient: string,
    count = 1,
    event = eventType,
  ): Promise<void> {
    for (let n = 0; n < count; n += 1) {
      await target.send({ eventType: event, recipient: { subject: recipient }, variables: { n } });
    }
    await target.drain();
  }

  function inboxOf(token: string, query: Record<string, string | number> = {}) {
    return scenario
      .http()
      .get('/v1/inbox')
      .query(query)
      .set('authorization', bearer(token))
      .expect(200);
  }

  it('liệt kê theo trang đúng hình và mới nhất trước', async () => {
    await deliverTo(scenario, 'u-1', 3);
    const token = await scenario.userToken('u-1');
    const response = await inboxOf(token, { size: 2 });
    expect(response.body).toMatchObject({ code: 'SUCCESS', message: null });
    expect(response.body.result).toMatchObject({
      page: 1,
      size: 2,
      totalElements: 3,
      totalPages: 2,
    });
    expect(response.body.result.content).toHaveLength(2);
    expect(response.body.result.content[0]).toMatchObject({ eventType, readAt: null });
    expect(response.body.result.content[0].title).toMatch(/^Title \d$/);
    const [first, second] = response.body.result.content as { createdAt: string }[];
    expect((first?.createdAt ?? '') >= (second?.createdAt ?? '')).toBe(true);
  });

  it('đếm chưa đọc, đọc một tin, đọc tất cả', async () => {
    await deliverTo(scenario, 'u-1', 3);
    const token = await scenario.userToken('u-1');
    const auth = bearer(token);
    const count = async () =>
      (await scenario.http().get('/v1/inbox/unread-count').set('authorization', auth).expect(200))
        .body.result.count;
    expect(await count()).toBe(3);

    const [item] = (await inboxOf(token)).body.result.content as { id: string }[];
    const read = await scenario
      .http()
      .post(`/v1/inbox/${item?.id}/read`)
      .set('authorization', auth)
      .expect(200);
    expect(read.body.result.readAt).toEqual(expect.any(String));
    const firstReadAt = read.body.result.readAt as string;
    const again = await scenario
      .http()
      .post(`/v1/inbox/${item?.id}/read`)
      .set('authorization', auth)
      .expect(200);
    expect(again.body.result.readAt).toBe(firstReadAt);
    expect(await count()).toBe(2);

    const unread = await inboxOf(token, { unreadOnly: 'true' });
    expect(unread.body.result.totalElements).toBe(2);

    const all = await scenario
      .http()
      .post('/v1/inbox/read-all')
      .set('authorization', auth)
      .expect(200);
    expect(all.body.result.updated).toBe(2);
    expect(await count()).toBe(0);
  });

  it('người khác trong cùng tenant không thấy và không đánh dấu được', async () => {
    await deliverTo(scenario, 'u-1');
    const owner = await scenario.userToken('u-1');
    const stranger = await scenario.userToken('u-2');
    const [item] = (await inboxOf(owner)).body.result.content as { id: string }[];

    expect((await inboxOf(stranger)).body.result.totalElements).toBe(0);
    await scenario
      .http()
      .post(`/v1/inbox/${item?.id}/read`)
      .set('authorization', bearer(stranger))
      .expect(404);
    const all = await scenario
      .http()
      .post('/v1/inbox/read-all')
      .set('authorization', bearer(stranger))
      .expect(200);
    expect(all.body.result.updated).toBe(0);
    const unread = await scenario
      .http()
      .get('/v1/inbox/unread-count')
      .set('authorization', bearer(owner))
      .expect(200);
    expect(unread.body.result.count).toBe(1);
  });

  it('cùng mã người dùng ở tenant khác không thấy tin', async () => {
    await deliverTo(scenario, 'u-1');
    const owner = await scenario.userToken('u-1');
    const [item] = (await inboxOf(owner)).body.result.content as { id: string }[];
    const other = await Scenario.start(subject);
    const foreign = await other.userToken('u-1');
    expect((await inboxOf(foreign)).body.result.totalElements).toBe(0);
    await scenario
      .http()
      .post(`/v1/inbox/${item?.id}/read`)
      .set('authorization', bearer(foreign))
      .expect(404);
  });

  it('admin cũng chỉ thấy hộp thư của chính mình', async () => {
    await deliverTo(scenario, 'u-1');
    expect((await inboxOf(scenario.admin)).body.result.totalElements).toBe(0);
  });

  it('tin không tồn tại trả 404, id sai dạng trả 400', async () => {
    const token = await scenario.userToken('u-1');
    const missing = await scenario
      .http()
      .post(`/v1/inbox/${randomUUID()}/read`)
      .set('authorization', bearer(token))
      .expect(404);
    expect(missing.body.code).toBe('NOTIFICATION.INBOX_ITEM_NOT_FOUND');
    await scenario
      .http()
      .post('/v1/inbox/not-a-uuid/read')
      .set('authorization', bearer(token))
      .expect(400);
  });

  it('gửi lại sau khi mất kết quả không tạo tin trùng', async () => {
    await scenario.send({ eventType, recipient: { subject: 'u-1' }, variables: { n: 1 } });
    await scenario.drain();
    const [delivery] = await scenario.deliveriesOf(eventType);
    await scenario.prisma.notificationDelivery.update({
      where: { id: delivery?.id },
      data: { status: 'PROCESSING', lockedUntil: new Date(Date.now() - 1000) },
    });
    await scenario.drain();
    const token = await scenario.userToken('u-1');
    expect((await inboxOf(token)).body.result.totalElements).toBe(1);
  });

  it('yêu cầu đăng nhập', async () => {
    await scenario.http().get('/v1/inbox').expect(401);
  });
});
