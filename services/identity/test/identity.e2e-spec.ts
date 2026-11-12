import { randomUUID } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import request from 'supertest';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { IdentityCleanupJob } from '../src/modules/identity/jobs/identity-cleanup.job';
import {
  APPLE_CLIENT,
  APPLE_ISSUER,
  FACEBOOK_APP,
  FakeProfile,
  GOOGLE_CLIENT,
  GOOGLE_ISSUER,
} from './support/fake-social-providers';
import { BOOTSTRAP_ADMIN, createTestApp, TestApp } from './support/test-app';

const PASSWORD = 'correct-horse-battery';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('identity', () => {
  let subject: TestApp;
  let prisma: PrismaService;
  const http = () => request(subject.app.getHttpServer());
  const email = () => `user-${randomUUID()}@identity.test`;
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    subject = await createTestApp();
    prisma = subject.app.get(PrismaService);
  });

  afterAll(() => subject.close());

  beforeEach(() => {
    subject.social.failing = false;
  });

  async function register(address: string, password = PASSWORD): Promise<void> {
    await http().post('/v1/auth/register').send({ email: address, password }).expect(202);
  }

  function codeFor(address: string): string {
    return subject.otp.latestFor(address)?.code as string;
  }

  async function registerVerified(address: string = email(), password = PASSWORD): Promise<string> {
    await register(address, password);
    await http()
      .post('/v1/auth/verify-email')
      .send({ email: address, code: codeFor(address) })
      .expect(200);
    return address;
  }

  async function login(address: string, tenantId?: string, password = PASSWORD): Promise<Tokens> {
    const { body } = await http()
      .post('/v1/auth/login')
      .send({ email: address, password, tenantId })
      .expect(200);
    return body.result as Tokens;
  }

  const principalOf = (address: string) =>
    prisma.principal.findUniqueOrThrow({ where: { email: address } });
  const adminToken = async () =>
    (await login(BOOTSTRAP_ADMIN.email, undefined, BOOTSTRAP_ADMIN.password)).accessToken;

  async function createTenant(): Promise<string> {
    const admin = await adminToken();
    const slug = `t-${randomUUID().slice(0, 18)}`;
    const { body } = await http()
      .post('/v1/tenants')
      .set(bearer(admin))
      .send({ slug, name: slug })
      .expect(201);
    return body.result.id as string;
  }

  async function addRole(
    tenantId: string,
    name: string,
    permissions: string[] = [],
  ): Promise<void> {
    await http()
      .put(`/v1/tenants/${tenantId}/roles`)
      .set(bearer(await adminToken()))
      .send({ name, permissions })
      .expect(200);
  }

  async function addMember(tenantId: string, address: string, roles: string[] = []): Promise<void> {
    await http()
      .post(`/v1/tenants/${tenantId}/members`)
      .set(bearer(await adminToken()))
      .send({ email: address, roles })
      .expect(201);
  }

  describe('đăng ký và xác minh email', () => {
    it('đăng ký, xác minh rồi đăng nhập được', async () => {
      const address = await registerVerified();
      const tokens = await login(address);
      const { body } = await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(200);
      expect(body.result).toMatchObject({ email: address, emailVerified: true, hasPassword: true });
    });

    it('chưa xác minh thì chưa đăng nhập được', async () => {
      const address = email();
      await register(address);
      const { body } = await http()
        .post('/v1/auth/login')
        .send({ email: address, password: PASSWORD })
        .expect(403);
      expect(body.code).toBe('IDENTITY.EMAIL_NOT_VERIFIED');
    });

    it('đăng ký email đã tồn tại trả cùng kết quả và không tạo thêm', async () => {
      const address = await registerVerified();
      const again = await http()
        .post('/v1/auth/register')
        .send({ email: address, password: 'another-password' })
        .expect(202);
      expect(again.body.result).toEqual({ accepted: true });
      expect(await prisma.principal.count({ where: { email: address } })).toBe(1);
      await login(address);
    });

    it('chuẩn hoá email về chữ thường', async () => {
      const address = email();
      await register(address.toUpperCase());
      expect(await prisma.principal.count({ where: { email: address } })).toBe(1);
    });

    it('đăng ký phát sự kiện cùng giao dịch', async () => {
      const address = email();
      await register(address);
      const { id } = await principalOf(address);
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: id, type: 'user.registered' } }),
      ).toBe(1);
    });

    it('không lưu mã OTP dạng rõ', async () => {
      const address = email();
      await register(address);
      const { id } = await principalOf(address);
      const stored = await prisma.otpCode.findFirstOrThrow({ where: { principalId: id } });
      expect(stored.codeHash).not.toBe(codeFor(address));
      expect(stored.codeHash).toHaveLength(64);
    });

    it('mã sai quá số lần thì mã đúng cũng hết hiệu lực', async () => {
      const address = email();
      await register(address);
      const good = codeFor(address);
      const wrong = good === '000000' ? '000001' : '000000';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await http()
          .post('/v1/auth/verify-email')
          .send({ email: address, code: wrong })
          .expect(400);
      }
      const { body } = await http()
        .post('/v1/auth/verify-email')
        .send({ email: address, code: good })
        .expect(400);
      expect(body.code).toBe('IDENTITY.INVALID_OTP');
    });

    it('không dùng lại được mã đã dùng', async () => {
      const address = email();
      await register(address);
      const code = codeFor(address);
      await http().post('/v1/auth/verify-email').send({ email: address, code }).expect(200);
      await http().post('/v1/auth/verify-email').send({ email: address, code }).expect(400);
    });

    it('gửi đồng thời cùng một mã chỉ một request thành công', async () => {
      const address = email();
      await register(address);
      const code = codeFor(address);
      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          http().post('/v1/auth/verify-email').send({ email: address, code }),
        ),
      );
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    });

    it('gửi lại trong thời gian chờ không sinh mã mới', async () => {
      const address = email();
      await register(address);
      const first = codeFor(address);
      const sentBefore = subject.otp.messages.length;
      await http().post('/v1/auth/resend-verification').send({ email: address }).expect(202);
      expect(subject.otp.messages.length).toBe(sentBefore);
      expect(codeFor(address)).toBe(first);
    });
  });

  describe('đăng nhập', () => {
    it('sai mật khẩu và không có tài khoản trả cùng một lỗi', async () => {
      const address = await registerVerified();
      const wrong = await http()
        .post('/v1/auth/login')
        .send({ email: address, password: 'wrong-password' })
        .expect(401);
      const missing = await http()
        .post('/v1/auth/login')
        .send({ email: email(), password: 'wrong-password' })
        .expect(401);
      expect(wrong.body.code).toBe('IDENTITY.INVALID_CREDENTIALS');
      expect(missing.body.code).toBe(wrong.body.code);
      expect(missing.body.message).toBe(wrong.body.message);
    });

    it('khoá tạm sau nhiều lần sai, kể cả khi sau đó nhập đúng', async () => {
      const address = await registerVerified();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await http()
          .post('/v1/auth/login')
          .send({ email: address, password: 'wrong-password' })
          .expect(401);
      }
      await http().post('/v1/auth/login').send({ email: address, password: PASSWORD }).expect(401);
      expect((await principalOf(address)).lockedUntil).not.toBeNull();
    });

    it('đăng nhập đúng xoá bộ đếm sai', async () => {
      const address = await registerVerified();
      await http()
        .post('/v1/auth/login')
        .send({ email: address, password: 'wrong-password' })
        .expect(401);
      await login(address);
      expect((await principalOf(address)).failedLogins).toBe(0);
    });

    it('ghi audit cả thành công lẫn thất bại', async () => {
      const address = await registerVerified();
      const { id } = await principalOf(address);
      await http()
        .post('/v1/auth/login')
        .send({ email: address, password: 'wrong-password' })
        .expect(401);
      await login(address);
      const rows = await prisma.auditLog.findMany({
        where: { actorSubject: id, action: 'auth.login' },
      });
      expect(rows.map((row) => row.outcome).sort()).toEqual(['FAILURE', 'SUCCESS']);
    });

    it('tài khoản bị khoá không đăng nhập được', async () => {
      const address = await registerVerified();
      const { id } = await principalOf(address);
      await http()
        .post(`/v1/admin/principals/${id}/suspend`)
        .set(bearer(await adminToken()))
        .expect(204);
      const { body } = await http()
        .post('/v1/auth/login')
        .send({ email: address, password: PASSWORD })
        .expect(403);
      expect(body.code).toBe('IDENTITY.ACCOUNT_SUSPENDED');
    });
  });

  describe('token', () => {
    it('ký RS256 với đủ claim, không có mật khẩu hay email', async () => {
      const tokens = await login(await registerVerified());
      expect(decodeProtectedHeader(tokens.accessToken).alg).toBe('RS256');
      const claims = decodeJwt(tokens.accessToken);
      expect(claims).toMatchObject({ iss: 'https://issuer.test', roles: [], ver: 0 });
      expect(typeof claims.sid).toBe('string');
      expect(claims.email).toBeUndefined();
    });

    it('jwks công khai không chứa phần riêng tư', async () => {
      const { body } = await http().get('/.well-known/jwks.json').expect(200);
      expect(body.keys.length).toBeGreaterThan(0);
      for (const key of body.keys) {
        expect(key).not.toHaveProperty('d');
        expect(key).not.toHaveProperty('p');
      }
    });

    it('khoá riêng được mã hoá trong database', async () => {
      const key = await prisma.signingKey.findFirstOrThrow({ where: { status: 'ACTIVE' } });
      expect(key.privateKeyEnc).not.toContain('PRIVATE KEY');
      expect(key.privateKeyEnc.split('.')).toHaveLength(3);
    });

    it('xoay khoá: token cũ vẫn hợp lệ, token mới dùng khoá mới', async () => {
      const before = await login(await registerVerified());
      const { body } = await http()
        .post('/v1/admin/keys/rotate')
        .set(bearer(await adminToken()))
        .expect(200);
      await http().get('/v1/me').set(bearer(before.accessToken)).expect(200);
      const after = await login(await registerVerified());
      expect(decodeProtectedHeader(after.accessToken).kid).toBe(body.result.activeKid);
      await http().get('/v1/me').set(bearer(after.accessToken)).expect(200);
    });

    it('chỉ quản trị nền tảng mới xoay được khoá', async () => {
      const tokens = await login(await registerVerified());
      await http().post('/v1/admin/keys/rotate').set(bearer(tokens.accessToken)).expect(403);
    });

    it('hai lần khởi tạo không sinh hai khoá đang hoạt động', async () => {
      expect(await prisma.signingKey.count({ where: { status: 'ACTIVE' } })).toBe(1);
    });
  });

  describe('làm mới và thu hồi phiên', () => {
    const refresh = (refreshToken: string) =>
      http().post('/v1/auth/refresh').send({ refreshToken });
    const ageRefreshUse = async (refreshToken: string) => {
      const { createHash } = await import('node:crypto');
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await prisma.refreshToken.update({
        where: { tokenHash },
        data: { usedAt: new Date(Date.now() - 60_000) },
      });
    };

    it('đổi được refresh token mới và token mới dùng được', async () => {
      const first = await login(await registerVerified());
      const { body } = await refresh(first.refreshToken).expect(200);
      expect(body.result.refreshToken).not.toBe(first.refreshToken);
      await http().get('/v1/me').set(bearer(body.result.accessToken)).expect(200);
    });

    it('dùng lại token cũ sau thời gian ân hạn thì thu hồi cả phiên', async () => {
      const first = await login(await registerVerified());
      const { body: rotated } = await refresh(first.refreshToken).expect(200);
      await ageRefreshUse(first.refreshToken);
      const replay = await refresh(first.refreshToken).expect(401);
      expect(replay.body.code).toBe('IDENTITY.REFRESH_REUSED');
      await refresh(rotated.result.refreshToken).expect(401);
    });

    it('dùng lại ngay trong thời gian ân hạn không giết phiên', async () => {
      const first = await login(await registerVerified());
      const { body: rotated } = await refresh(first.refreshToken).expect(200);
      const retry = await refresh(first.refreshToken).expect(401);
      expect(retry.body.code).toBe('IDENTITY.REFRESH_INVALID');
      await refresh(rotated.result.refreshToken).expect(200);
    });

    it('refresh đồng thời chỉ một request thành công', async () => {
      const first = await login(await registerVerified());
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => refresh(first.refreshToken)),
      );
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    });

    it('token lạ bị từ chối', async () => {
      await refresh('x'.repeat(43)).expect(401);
    });

    it('đăng xuất làm access token và refresh token hết hiệu lực ngay', async () => {
      const tokens = await login(await registerVerified());
      await http().post('/v1/auth/logout').send({ refreshToken: tokens.refreshToken }).expect(200);
      const { body } = await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(401);
      expect(body.code).toBe('IDENTITY.SESSION_REVOKED');
      await refresh(tokens.refreshToken).expect(401);
    });

    it('xem và thu hồi một phiên khác', async () => {
      const address = await registerVerified();
      const first = await login(address);
      const second = await login(address);
      const { body } = await http()
        .get('/v1/me/sessions')
        .set(bearer(second.accessToken))
        .expect(200);
      expect(body.result.sessions).toHaveLength(2);
      const other = body.result.sessions.find((session: { current: boolean }) => !session.current);
      await http()
        .delete(`/v1/me/sessions/${other.id}`)
        .set(bearer(second.accessToken))
        .expect(204);
      await http().get('/v1/me').set(bearer(first.accessToken)).expect(401);
      await http().get('/v1/me').set(bearer(second.accessToken)).expect(200);
    });

    it('không thu hồi được phiên của người khác', async () => {
      const victim = await login(await registerVerified());
      const attacker = await login(await registerVerified());
      const sid = decodeJwt(victim.accessToken).sid as string;
      await http().delete(`/v1/me/sessions/${sid}`).set(bearer(attacker.accessToken)).expect(404);
      await http().get('/v1/me').set(bearer(victim.accessToken)).expect(200);
    });

    it('đăng xuất mọi nơi vô hiệu tất cả token', async () => {
      const address = await registerVerified();
      const first = await login(address);
      const second = await login(address);
      await http().post('/v1/me/logout-all').set(bearer(first.accessToken)).expect(200);
      await http().get('/v1/me').set(bearer(second.accessToken)).expect(401);
      await refresh(second.refreshToken).expect(401);
    });

    it('token mang phiên bản cũ bị từ chối dù phiên còn sống', async () => {
      const address = await registerVerified();
      const tokens = await login(address);
      await prisma.principal.update({
        where: { email: address },
        data: { tokenVersion: { increment: 1 } },
      });
      const { body } = await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(401);
      expect(body.code).toBe('IDENTITY.SESSION_REVOKED');
    });

    it('khoá tài khoản vô hiệu token đang dùng và phát sự kiện', async () => {
      const address = await registerVerified();
      const tokens = await login(address);
      const { id } = await principalOf(address);
      await http()
        .post(`/v1/admin/principals/${id}/suspend`)
        .set(bearer(await adminToken()))
        .expect(204);
      await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(401);
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: id, type: 'user.deactivated' } }),
      ).toBe(1);
    });

    it('dọn phiên và mã OTP đã hết hạn', async () => {
      const address = await registerVerified();
      const tokens = await login(address);
      const sid = decodeJwt(tokens.accessToken).sid as string;
      await prisma.session.update({
        where: { id: sid },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await subject.app.get(IdentityCleanupJob, { strict: false }).runOnce();
      expect(await prisma.session.findUnique({ where: { id: sid } })).toBeNull();
    });
  });

  describe('mật khẩu', () => {
    it('quên mật khẩu trả cùng kết quả dù email không tồn tại', async () => {
      const sentBefore = subject.otp.messages.length;
      const { body } = await http()
        .post('/v1/auth/password/forgot')
        .send({ email: email() })
        .expect(202);
      expect(body.result).toEqual({ accepted: true });
      expect(subject.otp.messages.length).toBe(sentBefore);
    });

    it('đặt lại mật khẩu xong thì mọi phiên cũ hết hiệu lực', async () => {
      const address = await registerVerified();
      const old = await login(address);
      await prisma.otpCode.deleteMany({ where: { principal: { email: address } } });
      await http().post('/v1/auth/password/forgot').send({ email: address }).expect(202);
      await http()
        .post('/v1/auth/password/reset')
        .send({ email: address, code: codeFor(address), newPassword: 'brand-new-password' })
        .expect(200);
      await http().get('/v1/me').set(bearer(old.accessToken)).expect(401);
      await http().post('/v1/auth/login').send({ email: address, password: PASSWORD }).expect(401);
      await login(address, undefined, 'brand-new-password');
    });

    it('đổi mật khẩu phải đúng mật khẩu hiện tại', async () => {
      const tokens = await login(await registerVerified());
      await http()
        .post('/v1/me/password')
        .set(bearer(tokens.accessToken))
        .send({ currentPassword: 'wrong', newPassword: 'brand-new-password' })
        .expect(401);
      await http()
        .post('/v1/me/password')
        .set(bearer(tokens.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-password' })
        .expect(200);
      await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    });

    it('từ chối mật khẩu quá ngắn', async () => {
      await http()
        .post('/v1/auth/register')
        .send({ email: email(), password: 'short' })
        .expect(400);
    });
  });

  describe('một tài khoản nhiều tenant', () => {
    it('cùng email ở hai tenant là một tài khoản, vai trò theo từng tenant', async () => {
      const address = await registerVerified();
      const [tenantA, tenantB] = [await createTenant(), await createTenant()];
      await addRole(tenantA, 'editor', ['media:write']);
      await addRole(tenantB, 'viewer', ['media:read']);
      await addMember(tenantA, address, ['editor']);
      await addMember(tenantB, address, ['viewer']);

      expect(await prisma.principal.count({ where: { email: address } })).toBe(1);
      const inA = decodeJwt((await login(address, tenantA)).accessToken);
      const inB = decodeJwt((await login(address, tenantB)).accessToken);
      expect(inA).toMatchObject({
        tenant_id: tenantA,
        roles: ['editor'],
        permissions: ['media:write'],
      });
      expect(inB).toMatchObject({
        tenant_id: tenantB,
        roles: ['viewer'],
        permissions: ['media:read'],
      });
      expect(inA.sub).toBe(inB.sub);
    });

    it('không đăng nhập được vào tenant mình không thuộc', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      const { body } = await http()
        .post('/v1/auth/login')
        .send({ email: address, password: PASSWORD, tenantId: tenant })
        .expect(403);
      expect(body.code).toBe('IDENTITY.NOT_A_MEMBER');
    });

    it('chuyển tenant cấp token mới theo vai trò tenant đó', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      await addRole(tenant, 'editor');
      await addMember(tenant, address, ['editor']);
      const tokens = await login(address);
      const { body } = await http()
        .post('/v1/auth/switch-tenant')
        .set(bearer(tokens.accessToken))
        .send({ tenantId: tenant })
        .expect(200);
      expect(decodeJwt(body.result.accessToken)).toMatchObject({
        tenant_id: tenant,
        roles: ['editor'],
      });
    });

    it('bị gỡ khỏi tenant thì phiên trong tenant đó chấm dứt', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      await addMember(tenant, address);
      const tokens = await login(address, tenant);
      const { id } = await principalOf(address);
      await http()
        .delete(`/v1/tenants/${tenant}/members/${id}`)
        .set(bearer(await adminToken()))
        .expect(204);
      await http().get('/v1/me').set(bearer(tokens.accessToken)).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    });

    it('tenant bị đình chỉ thì không đăng nhập vào được', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      await addMember(tenant, address);
      await http()
        .patch(`/v1/tenants/${tenant}`)
        .set(bearer(await adminToken()))
        .send({ status: 'SUSPENDED' })
        .expect(200);
      await http()
        .post('/v1/auth/login')
        .send({ email: address, password: PASSWORD, tenantId: tenant })
        .expect(403);
    });

    it('đổi vai trò phát sự kiện', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      await addRole(tenant, 'editor');
      await addMember(tenant, address);
      const { id } = await principalOf(address);
      await http()
        .put(`/v1/tenants/${tenant}/members/${id}/roles`)
        .set(bearer(await adminToken()))
        .send({ roles: ['editor'] })
        .expect(200);
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateId: id, tenantId: tenant, type: 'role.changed' },
        }),
      ).toBe(1);
    });

    it('gán vai trò không tồn tại bị từ chối', async () => {
      const address = await registerVerified();
      const tenant = await createTenant();
      const { body } = await http()
        .post(`/v1/tenants/${tenant}/members`)
        .set(bearer(await adminToken()))
        .send({ email: address, roles: ['ghost'] })
        .expect(400);
      expect(body.code).toBe('IDENTITY.ROLE_NOT_FOUND');
    });
  });

  describe('phân quyền quản trị tenant', () => {
    async function tenantAdmin(tenant: string): Promise<string> {
      const address = await registerVerified();
      await addRole(tenant, 'admin');
      await addMember(tenant, address, ['admin']);
      return (await login(address, tenant)).accessToken;
    }

    it('admin tenant quản lý được thành viên tenant mình', async () => {
      const tenant = await createTenant();
      const token = await tenantAdmin(tenant);
      await http().get(`/v1/tenants/${tenant}/members`).set(bearer(token)).expect(200);
    });

    it('admin tenant này không đụng được tenant khác', async () => {
      const [mine, other] = [await createTenant(), await createTenant()];
      const token = await tenantAdmin(mine);
      await http().get(`/v1/tenants/${other}/members`).set(bearer(token)).expect(403);
      await http()
        .put(`/v1/tenants/${other}/roles`)
        .set(bearer(token))
        .send({ name: 'hacked' })
        .expect(403);
    });

    it('admin tenant không tạo được tenant và không khoá được tài khoản', async () => {
      const tenant = await createTenant();
      const token = await tenantAdmin(tenant);
      await http()
        .post('/v1/tenants')
        .set(bearer(token))
        .send({ slug: 'nope-tenant', name: 'x' })
        .expect(403);
      await http()
        .post(`/v1/admin/principals/${randomUUID()}/suspend`)
        .set(bearer(token))
        .expect(403);
    });

    it('trùng slug tenant bị từ chối', async () => {
      const admin = await adminToken();
      const slug = `t-${randomUUID().slice(0, 18)}`;
      await http().post('/v1/tenants').set(bearer(admin)).send({ slug, name: 'a' }).expect(201);
      const { body } = await http()
        .post('/v1/tenants')
        .set(bearer(admin))
        .send({ slug, name: 'b' })
        .expect(409);
      expect(body.code).toBe('IDENTITY.TENANT_SLUG_TAKEN');
    });
  });

  describe('đăng nhập mạng xã hội', () => {
    const social = (provider: string, credential: string, extra: object = {}) =>
      http()
        .post(`/v1/auth/social/${provider}`)
        .send({ credential, ...extra });
    const profile = (overrides: Partial<FakeProfile> = {}): FakeProfile => ({
      id: String(Math.floor(Math.random() * 1e12)),
      email: email(),
      name: 'Social User',
      ...overrides,
    });
    const googleToken = (value: FakeProfile) =>
      subject.social.idToken(GOOGLE_ISSUER, GOOGLE_CLIENT, value);

    it('liệt kê năm nhà cung cấp đang bật', async () => {
      const { body } = await http().get('/v1/auth/providers').expect(200);
      expect(body.result.providers.sort()).toEqual([
        'APPLE',
        'FACEBOOK',
        'GITHUB',
        'GOOGLE',
        'ZALO',
      ]);
    });

    it('Google tạo tài khoản mới với email đã xác minh', async () => {
      const value = profile();
      const { body } = await social('GOOGLE', await googleToken(value)).expect(200);
      const me = await http().get('/v1/me').set(bearer(body.result.accessToken)).expect(200);
      expect(me.body.result).toMatchObject({
        email: value.email,
        emailVerified: true,
        hasPassword: false,
      });
    });

    it('đăng nhập lần hai vào đúng tài khoản cũ', async () => {
      const value = profile();
      const first = await social('GOOGLE', await googleToken(value)).expect(200);
      const second = await social('GOOGLE', await googleToken(value)).expect(200);
      expect(decodeJwt(second.body.result.accessToken).sub).toBe(
        decodeJwt(first.body.result.accessToken).sub,
      );
    });

    it('Google từ chối token cấp cho ứng dụng khác', async () => {
      const token = await subject.social.idToken(GOOGLE_ISSUER, 'other-client', profile());
      const { body } = await social('GOOGLE', token).expect(401);
      expect(body.code).toBe('IDENTITY.SOCIAL_CREDENTIAL_INVALID');
    });

    it('Apple đăng nhập được', async () => {
      const token = await subject.social.idToken(APPLE_ISSUER, APPLE_CLIENT, profile());
      await social('APPLE', token).expect(200);
    });

    it('Apple không nhận token của Google', async () => {
      await social('APPLE', await googleToken(profile())).expect(401);
    });

    it('Facebook đăng nhập được khi token thuộc đúng ứng dụng', async () => {
      const value = profile();
      subject.social.facebookTokens.set('fb-good', { ...value, appId: FACEBOOK_APP });
      await social('FACEBOOK', 'fb-good').expect(200);
    });

    it('Facebook từ chối token của ứng dụng khác', async () => {
      subject.social.facebookTokens.set('fb-foreign', { ...profile(), appId: 'another-app' });
      await social('FACEBOOK', 'fb-foreign').expect(401);
    });

    it('Zalo đăng nhập được và không có email', async () => {
      subject.social.zaloTokens.set('zalo-good', profile({ email: undefined }));
      const { body } = await social('ZALO', 'zalo-good').expect(200);
      const me = await http().get('/v1/me').set(bearer(body.result.accessToken)).expect(200);
      expect(me.body.result.email).toBeNull();
    });

    it('Zalo từ chối token không hợp lệ', async () => {
      await social('ZALO', 'zalo-unknown').expect(401);
    });

    it('GitHub đổi code và dùng email chính đã xác minh', async () => {
      const value = profile();
      subject.social.githubCodes.set('gh-good', value);
      const { body } = await social('GITHUB', 'gh-good', {
        redirectUri: 'http://localhost/callback',
      }).expect(200);
      const me = await http().get('/v1/me').set(bearer(body.result.accessToken)).expect(200);
      expect(me.body.result.email).toBe(value.email);
    });

    it('GitHub bỏ qua email chưa xác minh', async () => {
      subject.social.githubCodes.set('gh-unverified', profile({ verified: false }));
      const { body } = await social('GITHUB', 'gh-unverified').expect(200);
      const me = await http().get('/v1/me').set(bearer(body.result.accessToken)).expect(200);
      expect(me.body.result.email).toBeNull();
    });

    it('GitHub từ chối code sai', async () => {
      await social('GITHUB', 'gh-wrong').expect(401);
    });

    it('nhà cung cấp lỗi trả 503, không trả 401', async () => {
      subject.social.facebookTokens.set('fb-down', { ...profile(), appId: FACEBOOK_APP });
      subject.social.failing = true;
      const { body } = await social('FACEBOOK', 'fb-down').expect(503);
      expect(body.code).toBe('IDENTITY.PROVIDER_UNAVAILABLE');
    });

    it('từ chối tên nhà cung cấp không hỗ trợ', async () => {
      await social('MYSPACE', 'token').expect(400);
    });

    it('nhà cung cấp chưa bật trả 404', async () => {
      const disabled = await createTestApp({ ZALO_APP_SECRET: '', GOOGLE_CLIENT_IDS: '' });
      try {
        const { body } = await request(disabled.app.getHttpServer())
          .post('/v1/auth/social/ZALO')
          .send({ credential: 'x' })
          .expect(404);
        expect(body.code).toBe('IDENTITY.PROVIDER_DISABLED');
      } finally {
        await disabled.close();
      }
    });

    it('tự liên kết vào tài khoản đã xác minh cùng email', async () => {
      const address = await registerVerified();
      const { body } = await social(
        'GOOGLE',
        await googleToken(profile({ email: address })),
      ).expect(200);
      expect(decodeJwt(body.result.accessToken).sub).toBe((await principalOf(address)).id);
    });

    it('không chiếm tài khoản chưa xác minh cùng email', async () => {
      const address = email();
      await register(address);
      const { body } = await social(
        'GOOGLE',
        await googleToken(profile({ email: address })),
      ).expect(409);
      expect(body.code).toBe('IDENTITY.EMAIL_LINK_REQUIRED');
    });

    it('email chưa xác minh từ nhà cung cấp không được nối vào tài khoản có sẵn', async () => {
      const address = await registerVerified();
      const { body } = await social(
        'GOOGLE',
        await googleToken(profile({ email: address, verified: false })),
      ).expect(200);
      expect(decodeJwt(body.result.accessToken).sub).not.toBe((await principalOf(address)).id);
    });

    it('một tài khoản liên kết được hai nhà cung cấp và đăng nhập bằng cả hai', async () => {
      const tokens = await login(await registerVerified());
      const value = profile({ email: undefined });
      subject.social.githubCodes.set('gh-link', value);
      await http()
        .post('/v1/me/identities/GOOGLE')
        .set(bearer(tokens.accessToken))
        .send({ credential: await googleToken(value) })
        .expect(200);
      await http()
        .post('/v1/me/identities/GITHUB')
        .set(bearer(tokens.accessToken))
        .send({ credential: 'gh-link' })
        .expect(200);
      const { body } = await http()
        .get('/v1/me/identities')
        .set(bearer(tokens.accessToken))
        .expect(200);
      expect(
        body.result.identities.map((item: { provider: string }) => item.provider).sort(),
      ).toEqual(['GITHUB', 'GOOGLE']);
      const viaGithub = await social('GITHUB', 'gh-link').expect(200);
      expect(decodeJwt(viaGithub.body.result.accessToken).sub).toBe(
        decodeJwt(tokens.accessToken).sub,
      );
    });

    it('không liên kết được tài khoản mạng xã hội đã thuộc người khác', async () => {
      const value = profile();
      await social('GOOGLE', await googleToken(value)).expect(200);
      const tokens = await login(await registerVerified());
      const { body } = await http()
        .post('/v1/me/identities/GOOGLE')
        .set(bearer(tokens.accessToken))
        .send({ credential: await googleToken(value) })
        .expect(409);
      expect(body.code).toBe('IDENTITY.IDENTITY_ALREADY_LINKED');
    });

    it('không gỡ được phương thức đăng nhập cuối cùng', async () => {
      const { body: login } = await social('GOOGLE', await googleToken(profile())).expect(200);
      const { body } = await http()
        .delete('/v1/me/identities/GOOGLE')
        .set(bearer(login.result.accessToken))
        .expect(409);
      expect(body.code).toBe('IDENTITY.LAST_SIGN_IN_METHOD');
    });

    it('gỡ được khi còn mật khẩu', async () => {
      const tokens = await login(await registerVerified());
      await http()
        .post('/v1/me/identities/GOOGLE')
        .set(bearer(tokens.accessToken))
        .send({ credential: await googleToken(profile({ email: undefined })) })
        .expect(200);
      await http().delete('/v1/me/identities/GOOGLE').set(bearer(tokens.accessToken)).expect(204);
    });
  });

  describe('giới hạn tần suất đăng nhập', () => {
    it('giới hạn riêng các route xác thực, không ảnh hưởng route khác', async () => {
      const limited = await createTestApp({ AUTH_RATE_LIMIT_MAX: '2' });
      const server = () => request(limited.app.getHttpServer());
      try {
        const attempt = () =>
          server()
            .post('/v1/auth/login')
            .send({ email: 'nobody@identity.test', password: 'whatever-password' });
        await attempt().expect(401);
        await attempt().expect(401);
        const blocked = await attempt().expect(429);
        expect(blocked.body.code).toBe('COMMON.RATE_LIMITED');
        await server().get('/v1/auth/providers').expect(200);
        await server().get('/v1/auth/providers').expect(200);
        await server().get('/v1/auth/providers').expect(200);
      } finally {
        await limited.close();
      }
    });
  });

  describe('khởi tạo', () => {
    it('tạo quản trị nền tảng đúng một lần qua nhiều lần khởi động', async () => {
      expect(await prisma.principal.count({ where: { email: BOOTSTRAP_ADMIN.email } })).toBe(1);
      expect(decodeJwt(await adminToken()).roles).toEqual(['platform_admin']);
    });
  });
});
