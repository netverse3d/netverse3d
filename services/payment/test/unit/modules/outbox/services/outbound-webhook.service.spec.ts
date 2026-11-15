import { testAppConfig } from '@test/support/test-config';
import { randomBytes } from 'crypto';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { tenantWebhookSecretAad } from '@app/modules/tenant-webhooks/services/tenant-webhook-secret.util';
import {
  classifyResponse,
  nextRetryDelayMs,
  OutboundWebhookService,
} from '@app/modules/outbox/services/outbound-webhook.service';

describe('outbound webhook — chính sách giao hàng', () => {
  it.each([200, 201, 204])('HTTP %i -> delivered', (status) => {
    expect(classifyResponse(status)).toEqual({ outcome: 'delivered', httpStatus: status });
  });

  it.each([500, 502, 503, 504, 408, 425, 429])('HTTP %i -> retry (lỗi tạm thời)', (status) => {
    expect(classifyResponse(status)).toMatchObject({ outcome: 'retry', httpStatus: status });
  });

  it.each([400, 401, 403, 404, 410, 422])(
    'HTTP %i -> dead ngay (gửi lại y nguyên không thể thành công)',
    (status) => {
      expect(classifyResponse(status)).toMatchObject({ outcome: 'dead', httpStatus: status });
    },
  );

  it('backoff tăng gấp đôi, có jitter +-20%, trần 1 giờ', () => {
    const mid = () => 0.5;
    expect(nextRetryDelayMs(1, mid)).toBe(10_000);
    expect(nextRetryDelayMs(2, mid)).toBe(20_000);
    expect(nextRetryDelayMs(5, mid)).toBe(160_000);
    expect(nextRetryDelayMs(30, mid)).toBe(3_600_000);
    expect(nextRetryDelayMs(1, () => 0)).toBe(8_000);
    expect(nextRetryDelayMs(1, () => 1)).toBe(12_000);
  });

  it('body dựng từ event: occurredAt = lúc TẠO event, giống hệt nhau qua mọi lần retry', () => {
    const crypto = new ProviderCredentialCipher(
      `1:${randomBytes(32).toString('base64')}`,
    ) as ProviderCredentialCryptoService;
    const service = new OutboundWebhookService(testAppConfig({ NODE_ENV: 'test' }), crypto);
    const event = {
      id: 42n,
      event_type: 'payment.succeeded',
      created_at: new Date('2026-09-23T01:02:03.000Z'),
      payload_json: { publicId: 'pi_1', totalMinor: '49000' },
    };

    const first = service.buildBody(event);
    expect(JSON.parse(first)).toEqual({
      id: '42',
      type: 'payment.succeeded',
      occurredAt: '2026-09-23T01:02:03.000Z',
      payload: { publicId: 'pi_1', totalMinor: '49000' },
    });
    expect(service.buildBody(event)).toBe(first);
  });

  it('không theo redirect từ webhook tới địa chỉ khác', async () => {
    let redirected = 0;
    const server = createServer((request, response) => {
      if (request.url === '/private') redirected += 1;
      else response.writeHead(302, { location: '/private' });
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    const id = 'endpoint-1';
    const tenantId = 'tenant-1';
    const crypto = new ProviderCredentialCipher(
      `1:${randomBytes(32).toString('base64')}`,
    ) as ProviderCredentialCryptoService;
    const secret = crypto.encrypt(
      { secret_value: 'webhook-secret' },
      tenantWebhookSecretAad(tenantId, id),
    );
    const service = new OutboundWebhookService(testAppConfig({ NODE_ENV: 'test' }), crypto);
    const result = await service.send(
      {
        id,
        tenant_id: tenantId,
        url: `http://127.0.0.1:${port}/webhook`,
        secret_ciphertext: secret.ciphertext,
        secret_iv: secret.iv,
        secret_tag: secret.tag,
        secret_key_version: secret.keyVersion,
      },
      {
        id: 42n,
        event_type: 'payment.succeeded',
        created_at: new Date('2026-09-23T01:02:03.000Z'),
        payload_json: {},
      },
    );
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );

    expect(result).toEqual({ outcome: 'dead', httpStatus: 302, error: 'HTTP 302 (non-retryable)' });
    expect(redirected).toBe(0);
  });
});
