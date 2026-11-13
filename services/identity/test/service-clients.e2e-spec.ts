import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { TEST_AUDIENCE } from '@netverse/nest-kit/testing';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { BOOTSTRAP_ADMIN, createTestApp, TestApp } from './support/test-app';

interface CreatedClient {
  id: string;
  name: string;
  clientSecret: string;
}

describe('tài khoản của service', () => {
  let subject: TestApp;
  let prisma: PrismaService;
  let admin: string;
  const http = () => request(subject.app.getHttpServer());
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const clientName = () => `svc-${randomUUID().slice(0, 12)}`;

  beforeAll(async () => {
    subject = await createTestApp({ TOKEN_AUDIENCES: 'media,notification' });
    prisma = subject.app.get(PrismaService);
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: BOOTSTRAP_ADMIN.email, password: BOOTSTRAP_ADMIN.password })
      .expect(200);
    admin = login.body.result.accessToken as string;
  });

  afterAll(() => subject.close());

  async function createClient(overrides: Record<string, unknown> = {}): Promise<CreatedClient> {
    const { body } = await http()
      .post('/v1/admin/service-clients')
      .set(bearer(admin))
      .send({
        name: clientName(),
        audiences: ['media', TEST_AUDIENCE],
        permissions: ['media:read'],
        ...overrides,
      })
      .expect(201);
    return body.result as CreatedClient;
  }

  const tokenFor = (clientId: string, clientSecret: string, audience = 'media') =>
    http().post('/v1/auth/service-token').send({ clientId, clientSecret, audience });

  describe('quản trị', () => {
    it('tạo tài khoản trả khoá bí mật đúng một lần và chỉ lưu dạng băm', async () => {
      const created = await createClient();
      expect(created.clientSecret.length).toBeGreaterThanOrEqual(40);
      const row = await prisma.serviceClient.findUniqueOrThrow({ where: { id: created.id } });
      expect(JSON.stringify(row)).not.toContain(created.clientSecret);

      const listed = await http()
        .get('/v1/admin/service-clients?size=100')
        .set(bearer(admin))
        .expect(200);
      const item = listed.body.result.content.find(
        (entry: { id: string }) => entry.id === created.id,
      );
      expect(item).toMatchObject({ name: created.name, status: 'ACTIVE' });
      expect(JSON.stringify(listed.body)).not.toContain(created.clientSecret);
      expect(item.clientSecret).toBeUndefined();
    });

    it('trùng tên tài khoản bị từ chối', async () => {
      const created = await createClient();
      const { body } = await http()
        .post('/v1/admin/service-clients')
        .set(bearer(admin))
        .send({ name: created.name, audiences: ['media'], permissions: [] })
        .expect(409);
      expect(body.code).toBe('IDENTITY.SERVICE_CLIENT_NAME_TAKEN');
    });

    it('audience ngoài danh sách identity cấp được thì bị từ chối lúc tạo', async () => {
      const { body } = await http()
        .post('/v1/admin/service-clients')
        .set(bearer(admin))
        .send({ name: clientName(), audiences: ['unknown-service'], permissions: [] })
        .expect(400);
      expect(body.code).toBe('IDENTITY.AUDIENCE_UNKNOWN');
    });

    it.each([['Tên Sai'], ['-x'], ['a']])('tên %s sai dạng bị từ chối', async (name) => {
      await http()
        .post('/v1/admin/service-clients')
        .set(bearer(admin))
        .send({ name, audiences: ['media'], permissions: [] })
        .expect(400);
    });

    it('quyền sai dạng bị từ chối', async () => {
      await http()
        .post('/v1/admin/service-clients')
        .set(bearer(admin))
        .send({ name: clientName(), audiences: ['media'], permissions: ['Not A Permission'] })
        .expect(400);
    });

    it('chỉ quản trị nền tảng gọi được bốn route quản trị', async () => {
      const client = await createClient();
      const issued = await tokenFor(client.id, client.clientSecret, TEST_AUDIENCE).expect(200);
      const outsiders = [
        issued.body.result.accessToken as string,
        await subject.tokens.sign({
          subject: 'tenant-admin',
          tenantId: 'tenant-a',
          roles: ['admin'],
        }),
        await subject.tokens.sign({ subject: 'player' }),
        await subject.tokens.sign({
          subject: 'forged',
          tenantId: 'tenant-a',
          roles: ['platform_admin'],
        }),
      ];
      const body = { name: clientName(), audiences: ['media'], permissions: [] };
      for (const outsider of outsiders) {
        await http().get('/v1/admin/service-clients').set(bearer(outsider)).expect(403);
        await http().post('/v1/admin/service-clients').set(bearer(outsider)).send(body).expect(403);
        await http()
          .post(`/v1/admin/service-clients/${client.id}/rotate-secret`)
          .set(bearer(outsider))
          .expect(403);
        await http()
          .post(`/v1/admin/service-clients/${client.id}/revoke`)
          .set(bearer(outsider))
          .expect(403);
      }
      await http().get('/v1/admin/service-clients').expect(401);
      await tokenFor(client.id, client.clientSecret).expect(200);
    });

    it('tạo tài khoản không có audience nào bị từ chối', async () => {
      await http()
        .post('/v1/admin/service-clients')
        .set(bearer(admin))
        .send({ name: clientName(), audiences: [], permissions: [] })
        .expect(400);
    });

    it('đổi khoá ghi audit nhưng không kèm khoá mới', async () => {
      const client = await createClient();
      const rotated = await http()
        .post(`/v1/admin/service-clients/${client.id}/rotate-secret`)
        .set(bearer(admin))
        .expect(200);
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'service-client.rotate-secret', resourceId: client.id },
      });
      expect(JSON.stringify(row)).not.toContain(rotated.body.result.clientSecret as string);
    });

    it('thu hồi lần hai trả 404', async () => {
      const client = await createClient();
      const revoke = () =>
        http().post(`/v1/admin/service-clients/${client.id}/revoke`).set(bearer(admin));
      await revoke().expect(204);
      await revoke().expect(404);
    });

    it('ghi audit lúc tạo, không kèm khoá bí mật', async () => {
      const created = await createClient();
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'service-client.create', resourceId: created.id },
      });
      expect(row.outcome).toBe('SUCCESS');
      expect(JSON.stringify(row)).not.toContain(created.clientSecret);
    });
  });

  describe('cấp token', () => {
    it('đổi mã và khoá lấy token ngắn hạn, không tenant, không vai trò, đúng audience và quyền', async () => {
      const client = await createClient({ permissions: ['media:read', 'media:write'] });
      const { body } = await tokenFor(client.id, client.clientSecret).expect(200);
      expect(body.result).toMatchObject({ tokenType: 'Bearer', expiresIn: 300 });
      expect(body.result.refreshToken).toBeUndefined();

      const claims = decodeJwt(body.result.accessToken as string);
      expect(claims).toMatchObject({
        sub: `service:${client.name}`,
        client_id: client.id,
        aud: 'media',
        permissions: ['media:read', 'media:write'],
      });
      expect(claims.tenant_id).toBeUndefined();
      expect(claims.roles).toBeUndefined();
      expect(claims.sid).toBeUndefined();
      expect((claims.exp as number) - (claims.iat as number)).toBe(300);
    });

    it('sai khoá, sai mã và mã không tồn tại trả cùng một lỗi', async () => {
      const client = await createClient();
      const wrongSecret = await tokenFor(client.id, 'x'.repeat(43)).expect(401);
      const unknownClient = await tokenFor(randomUUID(), client.clientSecret).expect(401);
      expect(wrongSecret.body.code).toBe('IDENTITY.SERVICE_CLIENT_INVALID');
      expect(unknownClient.body.code).toBe('IDENTITY.SERVICE_CLIENT_INVALID');
      expect(unknownClient.body.message).toBe(wrongSecret.body.message);
    });

    it('audience ngoài danh sách của tài khoản bị từ chối', async () => {
      const client = await createClient({ audiences: ['media'] });
      const { body } = await tokenFor(client.id, client.clientSecret, 'notification').expect(403);
      expect(body.code).toBe('IDENTITY.AUDIENCE_NOT_ALLOWED');
    });

    it('đổi khoá thì khoá cũ hết dùng, khoá mới dùng được', async () => {
      const client = await createClient();
      const rotated = await http()
        .post(`/v1/admin/service-clients/${client.id}/rotate-secret`)
        .set(bearer(admin))
        .expect(200);
      const nextSecret = rotated.body.result.clientSecret as string;
      expect(nextSecret).not.toBe(client.clientSecret);
      await tokenFor(client.id, client.clientSecret).expect(401);
      await tokenFor(client.id, nextSecret).expect(200);
    });

    it('tài khoản bị thu hồi không lấy được token, và không đổi khoá được nữa', async () => {
      const client = await createClient();
      await http()
        .post(`/v1/admin/service-clients/${client.id}/revoke`)
        .set(bearer(admin))
        .expect(204);
      const refused = await tokenFor(client.id, client.clientSecret).expect(401);
      expect(refused.body.code).toBe('IDENTITY.SERVICE_CLIENT_INVALID');
      await http()
        .post(`/v1/admin/service-clients/${client.id}/rotate-secret`)
        .set(bearer(admin))
        .expect(404);
    });

    it('token của service bị từ chối ở route của người dùng', async () => {
      const client = await createClient();
      const issued = await tokenFor(client.id, client.clientSecret, TEST_AUDIENCE).expect(200);
      await http()
        .get('/v1/me')
        .set(bearer(issued.body.result.accessToken as string))
        .expect(403);
    });

    it('audience identity không còn cấp thì tài khoản cũ cũng không xin được', async () => {
      const client = await createClient({ audiences: ['media'] });
      await prisma.serviceClient.update({
        where: { id: client.id },
        data: { audiences: ['media', 'retired-service'] },
      });
      const { body } = await tokenFor(client.id, client.clientSecret, 'retired-service').expect(
        403,
      );
      expect(body.code).toBe('IDENTITY.AUDIENCE_NOT_ALLOWED');
    });

    it('token cấp cho service khác không dùng được ở identity', async () => {
      const client = await createClient();
      const issued = await tokenFor(client.id, client.clientSecret, 'media').expect(200);
      await http()
        .get('/v1/admin/service-clients')
        .set(bearer(issued.body.result.accessToken as string))
        .expect(401);
    });

    it('thiếu trường bắt buộc bị từ chối', async () => {
      await http().post('/v1/auth/service-token').send({ clientId: randomUUID() }).expect(400);
    });
  });
});
