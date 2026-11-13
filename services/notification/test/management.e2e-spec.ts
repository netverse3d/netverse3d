import { randomUUID } from 'node:crypto';
import { Scenario, uniqueEvent } from './support/scenario';
import { createTestApp, TestApp } from './support/test-app';

describe('quản trị template, thương hiệu, chặn địa chỉ và nhật ký', () => {
  let subject: TestApp;
  let scenario: Scenario;
  let other: Scenario;

  const bearer = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    subject = await createTestApp();
  });

  beforeEach(async () => {
    subject.email.reset();
    scenario = await Scenario.start(subject);
    other = await Scenario.start(subject);
  });

  afterAll(() => subject.close());

  describe('template', () => {
    it('tạo, đọc, sửa tăng phiên bản, xoá', async () => {
      const eventType = uniqueEvent();
      const created = await scenario.createTemplate({ eventType });
      expect(created.body.result).toMatchObject({
        eventType,
        channel: 'EMAIL',
        locale: 'en',
        version: 1,
      });
      const id = created.body.result.id as string;
      const auth = bearer(scenario.admin);

      const read = await scenario
        .http()
        .get(`/v1/templates/${id}`)
        .set('authorization', auth)
        .expect(200);
      expect(read.body.result.subject).toBe('Subject');

      const updated = await scenario
        .http()
        .patch(`/v1/templates/${id}`)
        .set('authorization', auth)
        .send({ subject: 'New' })
        .expect(200);
      expect(updated.body.result).toMatchObject({
        subject: 'New',
        version: 2,
        body: '<p>Hello {{name}}</p>',
      });
      const again = await scenario
        .http()
        .patch(`/v1/templates/${id}`)
        .set('authorization', auth)
        .send({ body: 'x' })
        .expect(200);
      expect(again.body.result.version).toBe(3);

      await scenario.http().delete(`/v1/templates/${id}`).set('authorization', auth).expect(204);
      await scenario.http().get(`/v1/templates/${id}`).set('authorization', auth).expect(404);
    });

    it('vai trò admin trên token không gắn tenant không quản lý được template', async () => {
      const tenantless = await subject.tokens.sign({ subject: 'eve', roles: ['admin'] });
      await scenario
        .http()
        .get('/v1/templates')
        .set('authorization', `Bearer ${tenantless}`)
        .expect(403);
    });

    it('token gắn tenant mang tên vai trò nền tảng không quản lý được template', async () => {
      const forged = await scenario.userToken('eve', ['platform_admin']);
      await scenario
        .http()
        .get('/v1/templates')
        .set('authorization', `Bearer ${forged}`)
        .expect(403);
    });

    it('trùng khoá sự kiện, kênh, ngôn ngữ bị từ chối', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType });
      const { body } = await scenario
        .http()
        .post('/v1/templates')
        .set('authorization', bearer(scenario.admin))
        .send({ eventType, channel: 'EMAIL', locale: 'en', subject: 'a', body: 'b' })
        .expect(409);
      expect(body.code).toBe('NOTIFICATION.TEMPLATE_KEY_TAKEN');
    });

    it('cùng khoá khác tenant thì được', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType });
      await other.createTemplate({ eventType });
    });

    it('template hỏng bị từ chối khi lưu và nêu đúng trường', async () => {
      const { body } = await scenario
        .http()
        .post('/v1/templates')
        .set('authorization', bearer(scenario.admin))
        .send({
          eventType: uniqueEvent(),
          channel: 'EMAIL',
          locale: 'en',
          subject: 'ok',
          body: 'Hello {{#if name}}',
        })
        .expect(400);
      expect(body.code).toBe('NOTIFICATION.TEMPLATE_INVALID');
      expect(body.details[0].field).toBe('body');
    });

    it('từ chối xuất thô trong thân email khi lưu', async () => {
      const { body } = await scenario
        .http()
        .post('/v1/templates')
        .set('authorization', bearer(scenario.admin))
        .send({
          eventType: uniqueEvent(),
          channel: 'EMAIL',
          locale: 'en',
          subject: 'ok',
          body: '{{{name}}}',
        })
        .expect(400);
      expect(body.code).toBe('NOTIFICATION.TEMPLATE_INVALID');
    });

    it('sửa thành template hỏng bị từ chối và giữ nguyên phiên bản', async () => {
      const { body } = await scenario.createTemplate({ eventType: uniqueEvent() });
      const id = body.result.id as string;
      const auth = bearer(scenario.admin);
      await scenario
        .http()
        .patch(`/v1/templates/${id}`)
        .set('authorization', auth)
        .send({ subject: '{{#each}}' })
        .expect(400);
      const read = await scenario
        .http()
        .get(`/v1/templates/${id}`)
        .set('authorization', auth)
        .expect(200);
      expect(read.body.result.version).toBe(1);
    });

    it('sửa mà không có trường nào bị từ chối', async () => {
      const { body } = await scenario.createTemplate({ eventType: uniqueEvent() });
      await scenario
        .http()
        .patch(`/v1/templates/${body.result.id}`)
        .set('authorization', bearer(scenario.admin))
        .send({})
        .expect(400);
    });

    it('tenant khác không đọc, sửa, xoá, liệt kê được template', async () => {
      const eventType = uniqueEvent();
      const { body } = await scenario.createTemplate({ eventType });
      const id = body.result.id as string;
      const auth = bearer(other.admin);
      await other.http().get(`/v1/templates/${id}`).set('authorization', auth).expect(404);
      await other
        .http()
        .patch(`/v1/templates/${id}`)
        .set('authorization', auth)
        .send({ body: 'x' })
        .expect(404);
      await other.http().delete(`/v1/templates/${id}`).set('authorization', auth).expect(404);
      const list = await other
        .http()
        .get('/v1/templates')
        .query({ eventType })
        .set('authorization', auth)
        .expect(200);
      expect(list.body.result.totalElements).toBe(0);
      await scenario
        .http()
        .get(`/v1/templates/${id}`)
        .set('authorization', bearer(scenario.admin))
        .expect(200);
    });

    it('danh sách có phân trang đúng hình và lọc theo sự kiện', async () => {
      const eventType = uniqueEvent();
      await scenario.createTemplate({ eventType, locale: 'en' });
      await scenario.createTemplate({ eventType, locale: 'fr' });
      await scenario.createTemplate({ eventType, locale: 'de' });
      await scenario.createTemplate({ eventType: uniqueEvent() });
      const response = await scenario
        .http()
        .get('/v1/templates')
        .query({ eventType, page: 2, size: 2 })
        .set('authorization', bearer(scenario.admin))
        .expect(200);
      expect(response.body).toMatchObject({
        code: 'SUCCESS',
        message: null,
        requestId: response.headers['x-request-id'],
      });
      expect(response.body.result).toMatchObject({
        page: 2,
        size: 2,
        totalElements: 3,
        totalPages: 2,
      });
      expect(response.body.result.content).toHaveLength(1);
    });

    it('từ chối sắp xếp theo trường ngoài danh sách', async () => {
      const { body } = await scenario
        .http()
        .get('/v1/templates?sort=tenantId,asc')
        .set('authorization', bearer(scenario.admin))
        .expect(400);
      expect(body.code).toBe('COMMON.VALIDATION');
    });

    it('từ chối kênh lạ', async () => {
      await scenario
        .http()
        .post('/v1/templates')
        .set('authorization', bearer(scenario.admin))
        .send({ eventType: uniqueEvent(), channel: 'SMS', locale: 'en', subject: 'a', body: 'b' })
        .expect(400);
    });

    it('ghi audit khi tạo template', async () => {
      const { body } = await scenario.createTemplate({ eventType: uniqueEvent() });
      const row = await scenario.prisma.auditLog.findFirstOrThrow({
        where: { action: 'template.create', resourceId: body.result.id },
      });
      expect(row).toMatchObject({ outcome: 'SUCCESS', tenantId: scenario.tenantId });
    });
  });

  describe('thương hiệu', () => {
    it('đặt, đọc, xoá theo khoá', async () => {
      const auth = bearer(scenario.admin);
      const put = await scenario
        .http()
        .put('/v1/branding/logoUrl')
        .set('authorization', auth)
        .send({ value: 'https://x.test/a.png' })
        .expect(200);
      expect(put.body.result).toMatchObject({ key: 'logoUrl', value: 'https://x.test/a.png' });
      await scenario
        .http()
        .put('/v1/branding/logoUrl')
        .set('authorization', auth)
        .send({ value: 'second' })
        .expect(200);
      const read = await scenario.http().get('/v1/branding').set('authorization', auth).expect(200);
      expect(read.body.result.entries).toEqual([
        expect.objectContaining({ key: 'logoUrl', value: 'second' }),
      ]);
      await scenario.http().delete('/v1/branding/logoUrl').set('authorization', auth).expect(204);
      await scenario.http().delete('/v1/branding/logoUrl').set('authorization', auth).expect(404);
    });

    it('tenant khác không thấy và không xoá được', async () => {
      await scenario
        .http()
        .put('/v1/branding/logoUrl')
        .set('authorization', bearer(scenario.admin))
        .send({ value: 'v' })
        .expect(200);
      const auth = bearer(other.admin);
      const read = await other.http().get('/v1/branding').set('authorization', auth).expect(200);
      expect(read.body.result.entries).toEqual([]);
      await other.http().delete('/v1/branding/logoUrl').set('authorization', auth).expect(404);
    });

    it.each(['__proto__', 'has-dash', '1digit'])('từ chối khoá %s', async (key) => {
      await scenario
        .http()
        .put(`/v1/branding/${key}`)
        .set('authorization', bearer(scenario.admin))
        .send({ value: 'v' })
        .expect(400);
    });
  });

  describe('chặn địa chỉ', () => {
    it('thêm, liệt kê có phân trang, gỡ', async () => {
      const auth = bearer(scenario.admin);
      const created = await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', auth)
        .send({ address: 'A@Example.test', reason: 'spam' })
        .expect(201);
      expect(created.body.result).toMatchObject({ address: 'a@example.test', reason: 'spam' });
      const list = await scenario
        .http()
        .get('/v1/blocked-addresses')
        .set('authorization', auth)
        .expect(200);
      expect(list.body.result).toMatchObject({
        page: 1,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });
      await scenario
        .http()
        .delete(`/v1/blocked-addresses/${created.body.result.id}`)
        .set('authorization', auth)
        .expect(204);
    });

    it('chặn trùng bị từ chối', async () => {
      const auth = bearer(scenario.admin);
      await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', auth)
        .send({ address: 'a@example.test' })
        .expect(201);
      const { body } = await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', auth)
        .send({ address: 'A@example.test' })
        .expect(409);
      expect(body.code).toBe('NOTIFICATION.ADDRESS_ALREADY_BLOCKED');
    });

    it('tenant khác không thấy và không gỡ được', async () => {
      const created = await scenario
        .http()
        .post('/v1/blocked-addresses')
        .set('authorization', bearer(scenario.admin))
        .send({ address: 'a@example.test' })
        .expect(201);
      const auth = bearer(other.admin);
      const list = await other
        .http()
        .get('/v1/blocked-addresses')
        .set('authorization', auth)
        .expect(200);
      expect(list.body.result.totalElements).toBe(0);
      await other
        .http()
        .delete(`/v1/blocked-addresses/${created.body.result.id}`)
        .set('authorization', auth)
        .expect(404);
    });
  });

  describe('nhật ký gửi', () => {
    it('lọc theo trạng thái và sự kiện, đúng hình phân trang', async () => {
      const sentEvent = uniqueEvent();
      const deadEvent = uniqueEvent();
      await scenario.createTemplate({ eventType: sentEvent, body: 'mail' });
      await scenario.send({ eventType: sentEvent, recipient: { email: 'a@example.test' } });
      await scenario.send({ eventType: deadEvent, recipient: { email: 'b@example.test' } });
      await scenario.drain();
      const auth = bearer(scenario.admin);

      const dead = await scenario
        .http()
        .get('/v1/deliveries')
        .query({ status: 'DEAD' })
        .set('authorization', auth)
        .expect(200);
      expect(dead.body.code).toBe('SUCCESS');
      expect(dead.body.result).toMatchObject({
        page: 1,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });
      expect(dead.body.result.content[0]).toMatchObject({
        eventType: deadEvent,
        status: 'DEAD',
        reason: 'TEMPLATE_NOT_FOUND',
        destination: 'b@example.test',
      });

      const byEvent = await scenario
        .http()
        .get('/v1/deliveries')
        .query({ eventType: sentEvent })
        .set('authorization', auth)
        .expect(200);
      expect(byEvent.body.result.content).toEqual([
        expect.objectContaining({ status: 'SENT', attempts: 1, templateVersion: 1 }),
      ]);

      const paged = await scenario
        .http()
        .get('/v1/deliveries')
        .query({ size: 1, page: 2, sort: 'createdAt,asc' })
        .set('authorization', auth)
        .expect(200);
      expect(paged.body.result).toMatchObject({
        page: 2,
        size: 1,
        totalElements: 2,
        totalPages: 2,
      });
    });

    it('từ chối trạng thái lạ', async () => {
      await scenario
        .http()
        .get('/v1/deliveries?status=NOPE')
        .set('authorization', bearer(scenario.admin))
        .expect(400);
    });

    it('tenant khác không thấy nhật ký', async () => {
      const eventType = uniqueEvent();
      await scenario.send({ eventType, recipient: { email: 'a@example.test' } });
      const list = await other
        .http()
        .get('/v1/deliveries')
        .query({ eventType })
        .set('authorization', bearer(other.admin))
        .expect(200);
      expect(list.body.result.totalElements).toBe(0);
    });
  });

  describe('kiểm vai trò', () => {
    const id = randomUUID();
    const adminRoutes: [string, string][] = [
      ['post', '/v1/templates'],
      ['get', '/v1/templates'],
      ['get', `/v1/templates/${id}`],
      ['patch', `/v1/templates/${id}`],
      ['delete', `/v1/templates/${id}`],
      ['get', '/v1/branding'],
      ['put', '/v1/branding/logoUrl'],
      ['delete', '/v1/branding/logoUrl'],
      ['post', '/v1/blocked-addresses'],
      ['get', '/v1/blocked-addresses'],
      ['delete', `/v1/blocked-addresses/${id}`],
      ['get', '/v1/deliveries'],
    ];

    function call(method: string, path: string) {
      const agent = scenario.http() as unknown as Record<
        string,
        (url: string) => import('supertest').Test
      >;
      return agent[method]?.(path) as import('supertest').Test;
    }

    it.each(adminRoutes)('%s %s chỉ cho admin', async (method, path) => {
      await call(method, path).expect(401);
      for (const roles of [[], ['member'], ['notification:send']]) {
        const token = await scenario.userToken('someone', roles);
        const { body } = await call(method, path).set('authorization', bearer(token)).expect(403);
        expect(body.code).toBe('COMMON.FORBIDDEN');
      }
    });

    it('gửi thông báo cần vai trò notification:send hoặc admin', async () => {
      const body = { eventType: uniqueEvent(), recipient: { email: 'a@example.test' } };
      const member = await scenario.userToken('someone', ['member']);
      await scenario.http().post('/v1/notifications').send(body).expect(401);
      await scenario
        .http()
        .post('/v1/notifications')
        .set('authorization', bearer(member))
        .send(body)
        .expect(403);
      await scenario
        .http()
        .post('/v1/notifications')
        .set('authorization', bearer(scenario.service))
        .send(body)
        .expect(201);
      await scenario
        .http()
        .post('/v1/notifications')
        .set('authorization', bearer(scenario.admin))
        .send(body)
        .expect(201);
    });

    it('token không có tenant bị từ chối ở route theo tenant', async () => {
      const token = await subject.tokens.sign({
        subject: 'caller',
        roles: ['admin', 'notification:send'],
      });
      const send = await scenario
        .http()
        .post('/v1/notifications')
        .set('authorization', bearer(token))
        .send({ eventType: uniqueEvent(), recipient: { email: 'a@example.test' } })
        .expect(403);
      expect(send.body.code).toBe('NOTIFICATION.TENANT_REQUIRED');
      await scenario.http().get('/v1/templates').set('authorization', bearer(token)).expect(403);
      await scenario.http().get('/v1/inbox').set('authorization', bearer(token)).expect(403);
    });

    it('người dùng thường quản lý được opt-out của chính mình', async () => {
      const token = await scenario.userToken('someone');
      await scenario
        .http()
        .get('/v1/preferences/opt-outs')
        .set('authorization', bearer(token))
        .expect(200);
    });
  });
});
