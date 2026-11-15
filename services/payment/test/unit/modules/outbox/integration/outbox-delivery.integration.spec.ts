import { testAppConfig } from '@test/support/test-config';
import { IT_DATABASE_URL } from '@test/support/integration-env';
import { randomBytes, randomUUID } from 'crypto';
import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@app/infrastructure/prisma/client';
import { verifyPayloadSignature } from '@app/modules/shared/utils/signature.util';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { TransactionRunner } from '@app/infrastructure/prisma/transaction-runner';
import { TenantWebhookRepository } from '@app/modules/tenant-webhooks/repositories/tenant-webhook.repository';
import { PaymentOutboxDeliveryRepository } from '@app/modules/outbox/repositories/payment-outbox-delivery.repository';
import { PaymentOutboxRepository } from '@app/modules/outbox/repositories/payment-outbox.repository';
import { OutboundWebhookService } from '@app/modules/outbox/services/outbound-webhook.service';
import { OutboxDeliveryService } from '@app/modules/outbox/services/outbox-delivery.service';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { tenantWebhookSecretAad } from '@app/modules/tenant-webhooks/services/tenant-webhook-secret.util';

const describeIntegration = IT_DATABASE_URL ? describe : describe.skip;

interface Received {
  path: string;
  eventId: string;
  body: string;
  signatureValid: boolean;
}

describeIntegration('OutboxDeliveryService — tích hợp Postgres + HTTP', () => {
  let prisma: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let received: Received[];
  let script: Record<string, number[]>;
  let tenantId: string;

  const SECRET_A = 'whsec_a';
  const SECRET_B = 'whsec_b';
  const crypto = new ProviderCredentialCipher(
    `1:${randomBytes(32).toString('base64')}`,
  ) as ProviderCredentialCryptoService;

  function newService() {
    const db = prisma as unknown as PrismaService;
    return new OutboxDeliveryService(
      new PaymentOutboxRepository(db),
      new PaymentOutboxDeliveryRepository(db),
      new TenantWebhookRepository(db),
      new OutboundWebhookService(testAppConfig({ NODE_ENV: 'test' }), crypto),
      new TransactionRunner(db),
      testAppConfig({ NODE_ENV: 'test' }),
    );
  }

  beforeAll(async () => {
    const host = new URL(IT_DATABASE_URL!).host;
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
      throw new Error(
        `Integration test chi chay tren DB local dung mot lan, khong chay tren ${host}`,
      );
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: IT_DATABASE_URL!, options: '-c timezone=UTC' }),
    });
    await prisma.$connect();

    server = createServer((req: IncomingMessage, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const path = req.url ?? '/';
        const secret = path.startsWith('/a') ? SECRET_A : SECRET_B;
        received.push({
          path,
          eventId: String(req.headers['x-event-id']),
          body,
          signatureValid: verifyPayloadSignature(secret, body, String(req.headers['x-signature'])),
        });
        const plan = script[path] ?? [200];
        const count = received.filter((r) => r.path === path).length;
        res.statusCode = plan[Math.min(count, plan.length) - 1] ?? 200;
        res.end('{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    received = [];
    script = {};
    await prisma.$executeRawUnsafe('TRUNCATE tenants, audit_logs CASCADE');
    tenantId = (await prisma.tenants.create({ data: { code: 'it-outbox', name: 'Outbox' } })).id;
  });

  async function endpoint(path: string, secret: string, events = ['payment.succeeded']) {
    const id = randomUUID();
    const encrypted = crypto.encrypt(
      { secret_value: secret },
      tenantWebhookSecretAad(tenantId, id),
    );
    return prisma.tenant_webhook_endpoints.create({
      data: {
        id,
        tenant_id: tenantId,
        url: `${baseUrl}${path}`,
        secret_ciphertext: encrypted.ciphertext,
        secret_iv: encrypted.iv,
        secret_tag: encrypted.tag,
        secret_key_version: encrypted.keyVersion,
        subscribed_events: events,
      },
    });
  }

  async function event(eventType = 'payment.succeeded', extra: Record<string, unknown> = {}) {
    return prisma.payment_outbox_events.create({
      data: {
        tenant_id: tenantId,
        aggregate_type: 'payment_intent',
        aggregate_id: 'intent-1',
        event_type: eventType,
        payload_json: { publicId: 'pi_1', status: 'succeeded' },
        ...extra,
      },
    });
  }

  const makeDue = () =>
    prisma.payment_outbox_deliveries.updateMany({
      where: { status: 'pending' },
      data: { available_at: new Date(Date.now() - 1000) },
    });

  it('endpoint B lỗi 500 -> retry riêng B; endpoint A KHÔNG bị gửi lại', async () => {
    await endpoint('/a', SECRET_A);
    await endpoint('/b', SECRET_B);
    script['/b'] = [500, 200];
    const outbox = await event();
    const service = newService();

    await service.dispatchEvent(outbox.id);
    let deliveries = await prisma.payment_outbox_deliveries.findMany({
      include: { endpoint: true },
    });
    const byPath = (p: string) => deliveries.find((d) => d.endpoint.url.endsWith(p))!;
    expect(byPath('/a')).toMatchObject({
      status: 'delivered',
      attempt_count: 1,
      last_http_status: 200,
    });
    expect(byPath('/b')).toMatchObject({
      status: 'pending',
      attempt_count: 1,
      last_http_status: 500,
    });
    expect(byPath('/b').available_at.getTime()).toBeGreaterThan(Date.now());
    expect(
      (await prisma.payment_outbox_events.findUniqueOrThrow({ where: { id: outbox.id } }))
        .delivery_status,
    ).toBe('pending');

    await makeDue();
    await service.runOnce();

    deliveries = await prisma.payment_outbox_deliveries.findMany({ include: { endpoint: true } });
    expect(byPath('/b')).toBeDefined();
    expect(deliveries.every((d) => d.status === 'delivered')).toBe(true);
    expect(received.filter((r) => r.path === '/a')).toHaveLength(1);
    expect(received.filter((r) => r.path === '/b')).toHaveLength(2);
    expect(received.every((r) => r.signatureValid)).toBe(true);
    const finalEvent = await prisma.payment_outbox_events.findUniqueOrThrow({
      where: { id: outbox.id },
    });
    expect(finalEvent).toMatchObject({ delivery_status: 'delivered' });
    expect(finalEvent.processed_at).not.toBeNull();
  });

  it('body qua các lần retry GIỐNG HỆT nhau, occurredAt = lúc tạo event (không phải lúc retry)', async () => {
    await endpoint('/b', SECRET_B);
    script['/b'] = [503, 503, 200];
    const outbox = await event();
    const service = newService();

    await service.dispatchEvent(outbox.id);
    await makeDue();
    await service.runOnce();
    await makeDue();
    await service.runOnce();

    expect(received).toHaveLength(3);
    expect(new Set(received.map((r) => r.body)).size).toBe(1);
    expect(JSON.parse(received[0]?.body ?? '').occurredAt).toBe(outbox.created_at.toISOString());
  });

  it('HAI worker chạy đồng thời trên 15 event x 2 endpoint -> mỗi (event, endpoint) nhận ĐÚNG 1 lần', async () => {
    await endpoint('/a', SECRET_A);
    await endpoint('/b', SECRET_B);
    for (let i = 0; i < 15; i += 1) await event();

    const [w1, w2] = [newService(), newService()];
    await Promise.all([w1.fanOut(50), w2.fanOut(50)]);
    await Promise.all([w1.deliverDue(50), w2.deliverDue(50), w1.deliverDue(50), w2.deliverDue(50)]);

    expect(await prisma.payment_outbox_deliveries.count()).toBe(30);
    expect(await prisma.payment_outbox_deliveries.count({ where: { status: 'delivered' } })).toBe(
      30,
    );
    const keys = received.map((r) => `${r.path}:${r.eventId}`);
    expect(keys).toHaveLength(30);
    expect(new Set(keys).size).toBe(30);
  });

  it('4xx (vd tenant trả 401) -> dead ngay; retry tay đưa về pending rồi giao được', async () => {
    const ep = await endpoint('/b', SECRET_B);
    script['/b'] = [401, 200];
    const outbox = await event();
    const service = newService();

    await service.dispatchEvent(outbox.id);
    const dead = await prisma.payment_outbox_deliveries.findFirstOrThrow({
      where: { endpoint_id: ep.id },
    });
    expect(dead).toMatchObject({ status: 'dead', last_http_status: 401 });
    expect(
      (await prisma.payment_outbox_events.findUniqueOrThrow({ where: { id: outbox.id } }))
        .delivery_status,
    ).toBe('failed');

    expect(
      await new PaymentOutboxDeliveryRepository(prisma as unknown as PrismaService).requeueDead(
        dead.id,
      ),
    ).toBe(true);
    await service.runOnce();

    expect(
      await prisma.payment_outbox_deliveries.findUniqueOrThrow({ where: { id: dead.id } }),
    ).toMatchObject({ status: 'delivered' });
    expect(
      (await prisma.payment_outbox_events.findUniqueOrThrow({ where: { id: outbox.id } }))
        .delivery_status,
    ).toBe('delivered');
  });

  it('hết lượt retry (OUTBOX_MAX_ATTEMPTS) -> dead', async () => {
    await endpoint('/b', SECRET_B);
    script['/b'] = [500];
    const outbox = await event();
    const service = newService();
    await service.fanOut(10);
    await prisma.payment_outbox_deliveries.updateMany({ data: { attempt_count: 11 } });

    await service.runOnce();

    expect(
      await prisma.payment_outbox_deliveries.findFirstOrThrow({
        where: { outbox_event_id: outbox.id },
      }),
    ).toMatchObject({
      status: 'dead',
      attempt_count: 12,
    });
  });

  it('event CŨ (trước bảng deliveries, delivery_status failed) được fan-out và giao lại; event không ai đăng ký -> delivered', async () => {
    await endpoint('/a', SECRET_A, ['payment.succeeded']);
    const legacy = await event('payment.succeeded', {
      delivery_status: 'failed',
      fail_count: 3,
      last_error: 'old',
    });
    const unsubscribed = await event('payment.processing');

    await newService().runOnce();

    expect(
      await prisma.payment_outbox_events.findUniqueOrThrow({ where: { id: legacy.id } }),
    ).toMatchObject({ delivery_status: 'delivered' });
    expect(
      await prisma.payment_outbox_events.findUniqueOrThrow({ where: { id: unsubscribed.id } }),
    ).toMatchObject({
      delivery_status: 'delivered',
    });
    expect(received.map((r) => r.eventId)).toEqual([legacy.id.toString()]);
  });
});
