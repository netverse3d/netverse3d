import { PermanentSendError } from '../src/modules/channels/ports/channel-sender';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { DeliveryDispatchJob } from '../src/modules/delivery/jobs/delivery-dispatch.job';
import { DeliveryRepository } from '../src/modules/delivery/repositories/delivery.repository';
import { DeliveryDispatcherService } from '../src/modules/delivery/services/delivery-dispatcher.service';
import { OutboxRelayJob } from '@netverse/nest-kit';
import { Scenario, uniqueEvent } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

const EMAIL = 'user@example.test';

describe('đường gửi thông báo', () => {
  let subject: TestApp;
  let scenario: Scenario;

  beforeAll(async () => {
    subject = await createTestApp();
  });

  beforeEach(async () => {
    subject.email.reset();
    subject.push.reset();
    scenario = await Scenario.start(subject);
  });

  afterAll(() => subject.close());

  it('sự kiện có template thì gửi và ghi SENT kèm phiên bản template', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, subject: 'Subject {{name}}' });

    const response = await scenario.send({
      eventType,
      recipient: { email: EMAIL },
      variables: { name: 'Lan' },
    });
    expect(response.status).toBe(201);
    expect(response.body.code).toBe('SUCCESS');
    expect(response.body.result.deliveries).toEqual([
      expect.objectContaining({ channel: 'EMAIL', status: 'PENDING', reason: null }),
    ]);

    await scenario.drain();
    expect(subject.email.forEvent(eventType)).toEqual([
      expect.objectContaining({
        destination: EMAIL,
        subject: 'Subject Lan',
        body: '<p>Hello Lan</p>',
      }),
    ]);
    const [delivery] = await scenario.deliveriesOf(eventType);
    expect(delivery).toMatchObject({
      status: 'SENT',
      attempts: 1,
      templateVersion: 1,
      reason: null,
    });
    expect(delivery?.sentAt).not.toBeNull();
  });

  it('sự kiện không có template thì vào dead và ghi lý do', async () => {
    const eventType = uniqueEvent();
    await scenario.send({ eventType, recipient: { email: EMAIL } });
    await scenario.drain();
    expect(subject.email.forEvent(eventType)).toHaveLength(0);
    const [delivery] = await scenario.deliveriesOf(eventType);
    expect(delivery).toMatchObject({ status: 'DEAD', reason: 'TEMPLATE_NOT_FOUND', attempts: 1 });
    expect(delivery?.detail).toContain(eventType);
  });

  it('thiếu biến bắt buộc thì vào dead, không gửi nội dung trống', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType });
    await scenario.send({ eventType, recipient: { email: EMAIL }, variables: {} });
    await scenario.drain();
    expect(subject.email.forEvent(eventType)).toHaveLength(0);
    const [delivery] = await scenario.deliveriesOf(eventType);
    expect(delivery).toMatchObject({ status: 'DEAD', reason: 'MISSING_VARIABLE' });
    expect(delivery?.detail).toContain('name');
  });

  it('thoát HTML của biến trong thân email nhưng giữ nguyên ở tiêu đề', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, subject: 'Subject {{name}}' });
    await scenario.send({
      eventType,
      recipient: { email: EMAIL },
      variables: { name: '<script>x</script>' },
    });
    await scenario.drain();
    const [message] = subject.email.forEvent(eventType);
    expect(message?.body).toBe('<p>Hello &lt;script&gt;x&lt;/script&gt;</p>');
    expect(message?.subject).toBe('Subject <script>x</script>');
  });

  it('không thoát HTML ở kênh trong ứng dụng', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({
      eventType,
      channel: 'IN_APP',
      subject: 'T',
      body: 'A {{name}}',
    });
    await scenario.send({ eventType, recipient: { subject: 'u-1' }, variables: { name: 'B&C' } });
    await scenario.drain();
    const item = await scenario.prisma.inboxItem.findFirstOrThrow({
      where: { tenantId: scenario.tenantId },
    });
    expect(item.body).toBe('A B&C');
  });

  it('dùng template ngôn ngữ mặc định khi thiếu ngôn ngữ yêu cầu', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, locale: 'en', body: 'english' });
    await scenario.createTemplate({ eventType, locale: 'fr', body: 'french' });
    await scenario.send({ eventType, recipient: { email: EMAIL }, locale: 'fr' });
    await scenario.send({ eventType, recipient: { email: EMAIL }, locale: 'de' });
    await scenario.drain();
    expect(
      subject.email
        .forEvent(eventType)
        .map((message) => message.body)
        .sort(),
    ).toEqual(['english', 'french']);
  });

  it('template mới cập nhật được dùng và ghi đúng phiên bản', async () => {
    const eventType = uniqueEvent();
    const { body } = await scenario.createTemplate({ eventType, body: 'one' });
    await scenario
      .http()
      .patch(`/v1/templates/${body.result.id}`)
      .set('authorization', `Bearer ${scenario.admin}`)
      .send({ body: 'two' })
      .expect(200);
    await scenario.send({ eventType, recipient: { email: EMAIL } });
    await scenario.drain();
    expect(subject.email.forEvent(eventType)[0]?.body).toBe('two');
    expect((await scenario.deliveriesOf(eventType))[0]?.templateVersion).toBe(2);
  });

  it('thương hiệu của tenant dùng được trong template', async () => {
    const eventType = uniqueEvent();
    await scenario
      .http()
      .put('/v1/branding/productName')
      .set('authorization', `Bearer ${scenario.admin}`)
      .send({ value: 'Acme' })
      .expect(200);
    await scenario.createTemplate({ eventType, body: 'From {{brand.productName}}' });
    await scenario.send({ eventType, recipient: { email: EMAIL } });
    await scenario.drain();
    expect(subject.email.forEvent(eventType)[0]?.body).toBe('From Acme');
  });

  it('biến của người gọi không ghi đè được thương hiệu', async () => {
    const eventType = uniqueEvent();
    await scenario
      .http()
      .put('/v1/branding/productName')
      .set('authorization', `Bearer ${scenario.admin}`)
      .send({ value: 'Acme' })
      .expect(200);
    await scenario.createTemplate({ eventType, body: '{{brand.productName}}' });
    await scenario.send({
      eventType,
      recipient: { email: EMAIL },
      variables: { brand: { productName: 'Forged' } },
    });
    await scenario.drain();
    expect(subject.email.forEvent(eventType)[0]?.body).toBe('Acme');
  });

  it('tenant khác không dùng được template của tenant này', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType });
    const other = await Scenario.start(subject);
    await other.send({ eventType, recipient: { email: EMAIL }, variables: { name: 'x' } });
    await other.drain();
    expect(subject.email.forEvent(eventType)).toHaveLength(0);
    expect((await other.deliveriesOf(eventType))[0]).toMatchObject({
      status: 'DEAD',
      reason: 'TEMPLATE_NOT_FOUND',
    });
  });

  it('thương hiệu của tenant khác không lọt vào template', async () => {
    const eventType = uniqueEvent();
    await scenario
      .http()
      .put('/v1/branding/productName')
      .set('authorization', `Bearer ${scenario.admin}`)
      .send({ value: 'Acme' })
      .expect(200);
    const other = await Scenario.start(subject);
    await other.createTemplate({ eventType, body: '{{brand.productName}}' });
    await other.send({ eventType, recipient: { email: EMAIL } });
    await other.drain();
    expect((await other.deliveriesOf(eventType))[0]).toMatchObject({
      status: 'DEAD',
      reason: 'MISSING_VARIABLE',
    });
  });

  it('tách mỗi thiết bị thành một lần gửi riêng và bỏ token trùng', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, channel: 'PUSH', subject: 'T', body: 'B' });
    await scenario.send({ eventType, recipient: { deviceTokens: ['d-1', 'd-2', 'd-1'] } });
    await scenario.drain();
    expect(
      subject.push
        .forEvent(eventType)
        .map((message) => message.destination)
        .sort(),
    ).toEqual(['d-1', 'd-2']);
  });

  it('khi không chỉ định kênh thì chỉ dùng các kênh có template và có địa chỉ', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, channel: 'EMAIL', body: 'B' });
    const { body } = await scenario.send({
      eventType,
      recipient: { subject: 'u-1', email: EMAIL },
    });
    expect(body.result.deliveries.map((delivery: { channel: string }) => delivery.channel)).toEqual(
      ['EMAIL'],
    );
  });

  it('kênh được yêu cầu mà người nhận không có địa chỉ thì vào dead có lý do', async () => {
    const eventType = uniqueEvent();
    await scenario.createTemplate({ eventType, channel: 'PUSH', subject: 'T', body: 'B' });
    await scenario.send({ eventType, recipient: { email: EMAIL }, channels: ['PUSH'] });
    await scenario.drain();
    expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
      status: 'DEAD',
      reason: 'RECIPIENT_ADDRESS_MISSING',
      destination: null,
    });
  });

  it('từ chối người nhận không có địa chỉ nào', async () => {
    const response = await scenario.send({ eventType: uniqueEvent(), recipient: {} });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('NOTIFICATION.RECIPIENT_REQUIRED');
  });

  it('từ chối ký tự null trong biến thay vì lỗi 500', async () => {
    const response = await scenario.send({
      eventType: uniqueEvent(),
      recipient: { email: EMAIL },
      variables: { name: 'a\u0000b' },
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('NOTIFICATION.INVALID_CHARACTERS');
  });

  describe('từ chối nhận và chặn địa chỉ', () => {
    async function optOut(token: string, channel: string, eventType: string): Promise<void> {
      await scenario
        .http()
        .put('/v1/preferences/opt-outs')
        .set('authorization', `Bearer ${token}`)
        .send({ channel, eventType })
        .expect(200);
    }

    it('opt-out chỉ bỏ đúng kênh và đúng sự kiện', async () => {
      const eventType = uniqueEvent();
      const otherEvent = uniqueEvent();
      for (const event of [eventType, otherEvent]) {
        await scenario.createTemplate({ eventType: event, channel: 'EMAIL', body: 'mail' });
        await scenario.createTemplate({
          eventType: event,
          channel: 'IN_APP',
          subject: 'T',
          body: 'app',
        });
      }
      await optOut(await scenario.userToken('u-1'), 'EMAIL', eventType);

      const recipient = { subject: 'u-1', email: EMAIL };
      await scenario.send({ eventType, recipient, channels: ['EMAIL', 'IN_APP'] });
      await scenario.send({ eventType: otherEvent, recipient, channels: ['EMAIL', 'IN_APP'] });
      await scenario.drain();

      const deliveries = await scenario.deliveriesOf(eventType);
      expect(deliveries.find((row) => row.channel === 'EMAIL')).toMatchObject({
        status: 'SKIPPED',
        reason: 'OPTED_OUT',
      });
      expect(deliveries.find((row) => row.channel === 'IN_APP')).toMatchObject({ status: 'SENT' });
      expect(subject.email.forEvent(eventType)).toHaveLength(0);
      expect((await scenario.deliveriesOf(otherEvent)).map((row) => row.status)).toEqual([
        'SENT',
        'SENT',
      ]);
      expect(subject.email.forEvent(otherEvent)).toHaveLength(1);
    });

    it('opt-out chỉ áp dụng cho đúng người nhận', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await optOut(await scenario.userToken('u-1'), 'EMAIL', eventType);
      await scenario.send({ eventType, recipient: { subject: 'u-2', email: EMAIL } });
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(1);
    });

    it('bỏ opt-out thì nhận lại', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      const token = await scenario.userToken('u-1');
      await optOut(token, 'EMAIL', eventType);
      const list = await scenario
        .http()
        .get('/v1/preferences/opt-outs')
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.result.optOuts).toEqual([
        expect.objectContaining({ channel: 'EMAIL', eventType }),
      ]);
      await scenario
        .http()
        .delete('/v1/preferences/opt-outs')
        .query({ channel: 'EMAIL', eventType })
        .set('authorization', `Bearer ${token}`)
        .expect(204);
      await scenario.send({ eventType, recipient: { subject: 'u-1', email: EMAIL } });
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(1);
    });

    it('địa chỉ bị chặn được ghi skipped kèm lý do, không phân biệt hoa thường', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', `Bearer ${scenario.admin}`)
        .send({ address: 'BLOCKED@example.test', reason: 'bounced' })
        .expect(201);
      await scenario.send({ eventType, recipient: { email: 'blocked@EXAMPLE.test' } });
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(0);
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'SKIPPED',
        reason: 'ADDRESS_BLOCKED',
      });
    });

    it('chặn địa chỉ ở tenant này không ảnh hưởng tenant khác', async () => {
      const eventType = uniqueEvent();
      await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', `Bearer ${scenario.admin}`)
        .send({ address: EMAIL })
        .expect(201);
      const other = await Scenario.start(subject);
      await other.createTemplate({ eventType, body: 'mail' });
      await other.send({ eventType, recipient: { email: EMAIL } });
      await other.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(1);
    });
  });

  describe('idempotency', () => {
    it('gửi lại cùng khoá chỉ tạo một lần gửi', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      const body = { eventType, recipient: { email: EMAIL }, variables: { a: 1, b: 2 } };
      const first = await scenario.send(body, 'key-1');
      const second = await scenario.send({ ...body, variables: { b: 2, a: 1 } }, 'key-1');
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.result.id).toBe(first.body.result.id);
      await scenario.drain();
      expect(await scenario.deliveriesOf(eventType)).toHaveLength(1);
      expect(subject.email.forEvent(eventType)).toHaveLength(1);
    });

    it('dùng lại khoá với nội dung khác bị từ chối', async () => {
      const eventType = uniqueEvent();
      await scenario.send({ eventType, recipient: { email: EMAIL } }, 'key-1');
      const response = await scenario.send(
        { eventType, recipient: { email: 'other@example.test' } },
        'key-1',
      );
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('NOTIFICATION.IDEMPOTENCY_KEY_REUSED');
      expect(await scenario.deliveriesOf(eventType)).toHaveLength(1);
    });

    it('cùng khoá ở hai tenant là hai yêu cầu riêng', async () => {
      const eventType = uniqueEvent();
      const other = await Scenario.start(subject);
      const first = await scenario.send({ eventType, recipient: { email: EMAIL } }, 'shared-key');
      const second = await other.send({ eventType, recipient: { email: EMAIL } }, 'shared-key');
      expect(second.status).toBe(201);
      expect(second.body.result.id).not.toBe(first.body.result.id);
    });

    it('hai yêu cầu đồng thời cùng khoá chỉ tạo một thông báo', async () => {
      const eventType = uniqueEvent();
      const body = { eventType, recipient: { email: EMAIL } };
      const responses = await Promise.all([
        scenario.send(body, 'race'),
        scenario.send(body, 'race'),
      ]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses[0].body.result.id).toBe(responses[1].body.result.id);
      expect(await scenario.deliveriesOf(eventType)).toHaveLength(1);
    });

    it('khoá quá dài bị từ chối', async () => {
      const response = await scenario.send(
        { eventType: uniqueEvent(), recipient: { email: EMAIL } },
        'k'.repeat(129),
      );
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NOTIFICATION.IDEMPOTENCY_KEY_INVALID');
    });
  });

  describe('thử lại và đồng thời', () => {
    it('lỗi nhà cung cấp thì thử lại với backoff tăng dần rồi vào dead sau số lần tối đa', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.failure = new Error('provider down');

      const delays: number[] = [];
      for (const attempt of [1, 2]) {
        const before = Date.now();
        await scenario.drain();
        const [delivery] = await scenario.deliveriesOf(eventType);
        expect(delivery).toMatchObject({
          status: 'PENDING',
          attempts: attempt,
          reason: 'PROVIDER_ERROR',
          detail: 'provider down',
        });
        expect(delivery?.lockedUntil).toBeNull();
        delays.push((delivery?.nextAttemptAt.getTime() ?? 0) - before);
        await scenario.makeDue(eventType);
      }
      expect(delays[0]).toBeGreaterThan(50_000);
      expect(delays[0]).toBeLessThan(70_000);
      expect(delays[1]).toBeGreaterThan(110_000);
      expect(delays[1]).toBeLessThan(130_000);

      await scenario.drain();
      const [dead] = await scenario.deliveriesOf(eventType);
      expect(dead).toMatchObject({
        status: 'DEAD',
        attempts: 3,
        reason: 'MAX_ATTEMPTS_EXCEEDED',
        detail: 'provider down',
      });
      await scenario.drain();
      expect((await scenario.deliveriesOf(eventType))[0]?.attempts).toBe(3);
    });

    it('chưa tới giờ thử lại thì không gửi', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.failure = new Error('provider down');
      await scenario.drain();
      subject.email.failure = null;
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(0);
      expect((await scenario.deliveriesOf(eventType))[0]?.attempts).toBe(1);
    });

    it('lần thử sau thành công thì SENT và xoá lý do cũ', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.failure = new Error('provider down');
      await scenario.drain();
      subject.email.failure = null;
      await scenario.makeDue(eventType);
      await scenario.drain();
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'SENT',
        attempts: 2,
        reason: null,
        detail: null,
      });
    });

    it('lỗi vĩnh viễn của nhà cung cấp vào dead ngay', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.failure = new PermanentSendError(
        'PROVIDER_REJECTED',
        'rejected with status 400',
      );
      await scenario.drain();
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'DEAD',
        attempts: 1,
        reason: 'PROVIDER_REJECTED',
      });
    });

    it('lần gửi bị bỏ dở quá hạn giữ chỗ được nhận lại', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      await scenario.prisma.notificationDelivery.updateMany({
        where: { tenantId: scenario.tenantId, eventType },
        data: { status: 'PROCESSING', attempts: 1, lockedUntil: new Date(Date.now() - 1000) },
      });
      await scenario.drain();
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'SENT',
        attempts: 2,
      });
    });

    it('lần gửi đang giữ chỗ còn hạn thì không ai nhận', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      await scenario.prisma.notificationDelivery.updateMany({
        where: { tenantId: scenario.tenantId, eventType },
        data: { status: 'PROCESSING', attempts: 1, lockedUntil: new Date(Date.now() + 60_000) },
      });
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(0);
      await scenario.prisma.notificationDelivery.updateMany({
        where: { tenantId: scenario.tenantId, eventType },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      await scenario.drain();
    });

    it('bỏ dở quá số lần tối đa thì vào dead, không gửi thêm', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      await scenario.prisma.notificationDelivery.updateMany({
        where: { tenantId: scenario.tenantId, eventType },
        data: { status: 'PROCESSING', attempts: 3, lockedUntil: new Date(Date.now() - 1000) },
      });
      await scenario.drain();
      expect(subject.email.forEvent(eventType)).toHaveLength(0);
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'DEAD',
        reason: 'MAX_ATTEMPTS_EXCEEDED',
      });
    });

    it('hai worker chạy đồng thời không gửi trùng', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, channel: 'PUSH', subject: 'T', body: 'B' });
      const deviceTokens = Array.from({ length: 30 }, (_value, index) => `device-${index}`);
      await scenario.send({ eventType, recipient: { deviceTokens } });
      subject.push.delayMs = 5;

      const dispatcher = subject.app.get(DeliveryDispatcherService);
      const handled = await Promise.all([dispatcher.dispatchBatch(), dispatcher.dispatchBatch()]);
      expect(handled[0] + handled[1]).toBeGreaterThanOrEqual(30);

      const ids = subject.push.forEvent(eventType).map((message) => message.deliveryId);
      expect(ids).toHaveLength(30);
      expect(new Set(ids).size).toBe(30);
      const rows = await scenario.deliveriesOf(eventType);
      expect(rows.every((row) => row.status === 'SENT' && row.attempts === 1)).toBe(true);
    });

    it('worker đã hết lease không ghi đè kết quả của worker nhận lại', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      const repository = subject.app.get(DeliveryRepository, { strict: false });
      const claimOwn = async () =>
        (await repository.claimDue(500, 60_000)).find(
          (delivery) => delivery.eventType === eventType,
        );

      const stale = await claimOwn();
      await subject.app.get(PrismaService).notificationDelivery.updateMany({
        where: { eventType },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      const current = await claimOwn();
      expect(stale?.attempts).toBe(1);
      expect(current?.attempts).toBe(2);

      await repository
        .settle(stale as NonNullable<typeof stale>, {
          status: 'DEAD',
          reason: 'STALE_WORKER',
          detail: null,
        })
        .catch(() => undefined);
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'PROCESSING',
        attempts: 2,
      });

      await repository.settle(current as NonNullable<typeof current>, {
        status: 'SENT',
        reason: null,
        detail: null,
      });
      expect((await scenario.deliveriesOf(eventType))[0]).toMatchObject({
        status: 'SENT',
        attempts: 2,
      });
    });

    it('khoá tư vấn cho job chỉ một tiến trình chạy tại một thời điểm', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.delayMs = 200;
      const job = subject.app.get(DeliveryDispatchJob);
      const results = await Promise.all([job.runOnce(), job.runOnce()]);
      expect(results.filter((count) => count === 0).length).toBeGreaterThanOrEqual(1);
      expect(subject.email.forEvent(eventType)).toHaveLength(1);
    });
  });

  describe('sự kiện kết quả qua outbox', () => {
    async function relay(): Promise<void> {
      const job = subject.app.get(OutboxRelayJob);
      while ((await job.runOnce()) > 0) {
        await Promise.resolve();
      }
    }

    it('phát sự kiện khi gửi xong, không chứa địa chỉ người nhận', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      await scenario.drain();
      await relay();
      const [delivery] = await scenario.deliveriesOf(eventType);
      const event = subject.publisher.events.find((item) => item.data.deliveryId === delivery?.id);
      expect(event).toMatchObject({
        type: 'notification.delivery.sent',
        source: 'service-under-test',
        data: { status: 'SENT', eventType, channel: 'EMAIL', tenantId: scenario.tenantId },
      });
      expect(JSON.stringify(event)).not.toContain(EMAIL);
    });

    it('phát sự kiện dead và skipped kèm lý do', async () => {
      const deadEvent = uniqueEvent();
      await scenario.send({ eventType: deadEvent, recipient: { email: 'other@example.test' } });
      const skippedEvent = uniqueEvent();
      await scenario.createTemplate({ eventType: skippedEvent, body: 'mail' });
      await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', `Bearer ${scenario.admin}`)
        .send({ address: EMAIL })
        .expect(201);
      await scenario.send({ eventType: skippedEvent, recipient: { email: EMAIL } });
      await scenario.drain();
      await relay();
      const [dead] = await scenario.deliveriesOf(deadEvent);
      const [skipped] = await scenario.deliveriesOf(skippedEvent);
      expect(
        subject.publisher.events.find((item) => item.data.deliveryId === dead?.id),
      ).toMatchObject({
        type: 'notification.delivery.dead',
        data: { reason: 'TEMPLATE_NOT_FOUND' },
      });
      expect(
        subject.publisher.events.find((item) => item.data.deliveryId === skipped?.id),
      ).toMatchObject({
        type: 'notification.delivery.skipped',
        data: { reason: 'ADDRESS_BLOCKED' },
      });
    });

    it('lần thử lại chưa xong thì chưa phát sự kiện', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, body: 'mail' });
      await scenario.send({ eventType, recipient: { email: EMAIL } });
      subject.email.failure = new Error('provider down');
      await scenario.drain();
      const [delivery] = await scenario.deliveriesOf(eventType);
      expect(
        await scenario.prisma.outboxEvent.count({ where: { aggregateId: delivery?.id } }),
      ).toBe(0);
    });
  });
});
