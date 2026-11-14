import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { createTestApp, TestApp } from '@test/support/test-app';

const ACCOUNT_NUMBER = '1900123456';
const SEPAY_HMAC_SECRET = 'sepay-hmac-secret-value';

function sepayHeaders(rawBody: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    'content-type': 'application/json',
    'x-sepay-timestamp': timestamp,
    'x-sepay-signature': `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`,
  };
}

describe('payment-gateway-service qua HTTP', () => {
  let subject: TestApp;
  let adminToken: string;
  let tenantId: string;
  let apiKey: string;
  const http = () => request(subject.app.getHttpServer());

  beforeAll(async () => {
    subject = await createTestApp({
      PROVIDER_CREDENTIALS_KEYS: `1:${randomBytes(32).toString('base64')}`,
    });
    adminToken = await subject.tokens.sign({ roles: ['platform_admin'] });

    const tenant = await http()
      .post('/v1/internal/tenants')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ code: `e2e-${randomUUID()}`, name: 'E2E Tenant' })
      .expect(201);
    tenantId = tenant.body.result.id;

    const key = await http()
      .post(`/v1/internal/tenants/${tenantId}/api-keys`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ label: 'e2e-key' })
      .expect(201);
    apiKey = key.body.result.raw_api_key;
    expect(key.body.result.secret_hash).toBeUndefined();

    await http()
      .post(`/v1/internal/tenants/${tenantId}/provider-accounts`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        providerCode: 'vietqr',
        accountLabel: 'e2e',
        externalAccountRef: ACCOUNT_NUMBER,
        credentials: { sepayHmacSecret: SEPAY_HMAC_SECRET },
        config: {
          bankBin: '970415',
          accountNumber: ACCOUNT_NUMBER,
          bankName: 'VietinBank',
          accountName: 'E2E',
        },
      })
      .expect(201);
  });

  afterAll(() => subject.close());

  describe('xác thực', () => {
    it('route quản trị không token trả 401', async () => {
      await http().get('/v1/internal/tenants').expect(401);
    });

    it('route quản trị thiếu vai trò platform_admin trả 403', async () => {
      const token = await subject.tokens.sign({ roles: ['member'] });
      const { body } = await http()
        .post('/v1/internal/tenants')
        .set('authorization', `Bearer ${token}`)
        .send({})
        .expect(403);
      expect(body.code).toBe('COMMON.FORBIDDEN');
    });

    it('route tenant thiếu x-api-key trả 401 với mã nghiệp vụ', async () => {
      const { body } = await http().get('/v1/checkout-methods').expect(401);
      expect(body.code).toBe('PAYMENT.API_KEY_MISSING');
    });

    it('route tenant nhận API key hợp lệ và trả envelope', async () => {
      const { body } = await http()
        .get('/v1/checkout-methods')
        .set('x-api-key', apiKey)
        .expect(200);
      expect(body).toMatchObject({
        code: 'SUCCESS',
        result: { methods: [{ code: 'vietqr', flow: 'qr' }] },
      });
    });
  });

  describe('phân trang danh sách quản trị', () => {
    it('danh sách tenant trả đúng hình trang', async () => {
      const { body } = await http()
        .get('/v1/internal/tenants?page=1&size=1')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(body.result).toMatchObject({ page: 1, size: 1, totalElements: expect.any(Number) });
      expect(body.result.content).toHaveLength(1);
    });

    it('danh sách API key không lộ secret_hash', async () => {
      const { body } = await http()
        .get(`/v1/internal/tenants/${tenantId}/api-keys`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(body.result.content[0].secret_hash).toBeUndefined();
    });
  });

  describe('luồng thanh toán và webhook', () => {
    async function createIntent(reference: string) {
      const intent = await http()
        .post('/v1/payment-intents')
        .set('x-api-key', apiKey)
        .set('idempotency-key', `intent-${reference}`)
        .send({
          merchantReference: `merchant:subscription:${reference}`,
          targetType: 'subscription',
          targetRef: `s-${reference}`,
          targetSnapshot: { plan: 'monthly' },
          title: 'E2E',
          subtotalMinor: 49000,
        })
        .expect(201);
      return intent.body.result as { id: string; public_id: string; total_minor: number };
    }

    it('idempotency-key thiếu trả 400 với mã nghiệp vụ', async () => {
      const { body } = await http()
        .post('/v1/payment-intents')
        .set('x-api-key', apiKey)
        .send({
          targetType: 'subscription',
          targetRef: 's-1',
          targetSnapshot: {},
          title: 'E2E',
          subtotalMinor: 1000,
        })
        .expect(400);
      expect(body.code).toBe('PAYMENT.IDEMPOTENCY_KEY_REQUIRED');
    });

    it('tiền BigInt trả về dạng số và phát lại cùng khoá trả cùng intent', async () => {
      const reference = randomUUID().slice(0, 8);
      const first = await createIntent(reference);
      expect(first.total_minor).toBe(49000);
      const replay = await createIntent(reference);
      expect(replay.id).toBe(first.id);
    });

    it('webhook SePay ký đúng trên raw body thì ghi nhận thanh toán, phản hồi không bọc envelope', async () => {
      const reference = randomUUID().slice(0, 8);
      const intent = await createIntent(reference);
      const attempt = await http()
        .post(`/v1/payment-intents/${intent.public_id}/attempts`)
        .set('x-api-key', apiKey)
        .set('idempotency-key', `attempt-${reference}`)
        .send({ providerCode: 'vietqr' })
        .expect(201);
      const code = attempt.body.result.next_action.reference as string;

      const payload = {
        id: `tx-${reference}`,
        gateway: 'VietinBank',
        accountNumber: ACCOUNT_NUMBER,
        code,
        content: code,
        transferType: 'in',
        transferAmount: 49000,
        referenceCode: `FT${reference}`,
      };
      const rawBody = JSON.stringify(payload, null, 2);

      const { body } = await http()
        .post(`/v1/webhooks/vietqr/${ACCOUNT_NUMBER}`)
        .set(sepayHeaders(rawBody, SEPAY_HMAC_SECRET))
        .send(rawBody)
        .expect(200);
      expect(body).toEqual({ success: true });

      const fetched = await http()
        .get(`/v1/payment-intents/${intent.public_id}`)
        .set('x-api-key', apiKey)
        .expect(200);
      expect(fetched.body.result.status).toBe('succeeded');
    });

    it('webhook ký sai trả 401 theo định dạng của cổng', async () => {
      const rawBody = JSON.stringify({
        id: `tx-${randomUUID()}`,
        accountNumber: ACCOUNT_NUMBER,
        transferType: 'in',
        transferAmount: 1,
      });
      const { body } = await http()
        .post(`/v1/webhooks/vietqr/${ACCOUNT_NUMBER}`)
        .set(sepayHeaders(rawBody, 'wrong-secret'))
        .send(rawBody)
        .expect(401);
      expect(body).toEqual({ success: false });
    });
  });

  describe('cách ly tenant và khoá truy cập', () => {
    const admin = () => ({ authorization: `Bearer ${adminToken}` });

    async function issueTenantKey(): Promise<{ tenant: string; key: string }> {
      const tenant = await http()
        .post('/v1/internal/tenants')
        .set(admin())
        .send({ code: `iso-${randomUUID()}`, name: 'Isolated Tenant' })
        .expect(201);
      const created = await http()
        .post(`/v1/internal/tenants/${tenant.body.result.id}/api-keys`)
        .set(admin())
        .send({ label: 'isolated-key' })
        .expect(201);
      return {
        tenant: tenant.body.result.id as string,
        key: created.body.result.raw_api_key as string,
      };
    }

    async function createIntent(key: string): Promise<string> {
      const reference = randomUUID();
      const { body } = await http()
        .post('/v1/payment-intents')
        .set('x-api-key', key)
        .set('idempotency-key', `intent-${reference}`)
        .send({
          merchantReference: `merchant:isolation:${reference}`,
          targetType: 'subscription',
          targetRef: `s-${reference}`,
          targetSnapshot: { plan: 'monthly' },
          title: 'Isolation',
          subtotalMinor: 10000,
        })
        .expect(201);
      return body.result.public_id as string;
    }

    it('tenant khác không đọc được payment', async () => {
      const owner = await issueTenantKey();
      const stranger = await issueTenantKey();
      const publicId = await createIntent(owner.key);
      await http()
        .get(`/v1/payment-intents/${publicId}`)
        .set('x-api-key', stranger.key)
        .expect(404);
      await http().get(`/v1/payment-intents/${publicId}`).set('x-api-key', owner.key).expect(200);
    });

    it('API key đúng tiền tố nhưng sai secret bị từ chối', async () => {
      const { key } = await issueTenantKey();
      const forged = `${key.split('.')[0]}.${'x'.repeat(40)}`;
      const { body } = await http()
        .get('/v1/checkout-methods')
        .set('x-api-key', forged)
        .expect(401);
      expect(body.code).toBe('PAYMENT.API_KEY_INVALID');
    });

    it('API key đã thu hồi không dùng được', async () => {
      const { key } = await issueTenantKey();
      await http().get('/v1/checkout-methods').set('x-api-key', key).expect(200);
      await subject.app.get(PrismaService).tenant_api_keys.update({
        where: { key_prefix: key.split('.')[0] },
        data: { status: 'revoked' },
      });
      const { body } = await http().get('/v1/checkout-methods').set('x-api-key', key).expect(401);
      expect(body.code).toBe('PAYMENT.API_KEY_INVALID');
    });

    it('API key của tenant bị đình chỉ không dùng được', async () => {
      const { tenant, key } = await issueTenantKey();
      await subject.app
        .get(PrismaService)
        .tenants.update({ where: { id: tenant }, data: { status: 'suspended' } });
      await http().get('/v1/checkout-methods').set('x-api-key', key).expect(401);
    });

    it('route xem payment quản trị chặn người thiếu vai trò', async () => {
      const owner = await issueTenantKey();
      const publicId = await createIntent(owner.key);
      const member = await subject.tokens.sign({ roles: ['member'] });
      const { body } = await http()
        .get(`/v1/internal/payments/${owner.tenant}/intents/${publicId}`)
        .set('authorization', `Bearer ${member}`)
        .expect(403);
      expect(body.code).toBe('COMMON.FORBIDDEN');
      await http()
        .get(`/v1/internal/payments/${owner.tenant}/intents/${publicId}`)
        .set(admin())
        .expect(200);
    });

    it('audit ghi đúng API key và tenant cho thao tác của tenant', async () => {
      const { tenant, key } = await issueTenantKey();
      await createIntent(key);
      const prisma = subject.app.get(PrismaService);
      const issued = await prisma.tenant_api_keys.findUniqueOrThrow({
        where: { key_prefix: key.split('.')[0] },
      });
      const row = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'payment_intent.create', tenantId: tenant },
      });
      expect(row).toMatchObject({ actorSubject: issued.id, outcome: 'SUCCESS' });
    });
  });
});
