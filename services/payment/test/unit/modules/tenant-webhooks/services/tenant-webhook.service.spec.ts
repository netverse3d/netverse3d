import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import { randomBytes } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { tenant_webhook_endpoints } from '@app/infrastructure/prisma/prisma.types';
import {
  CreateTenantWebhookDto,
  UpdateTenantWebhookDto,
} from '@app/modules/tenant-webhooks/dto/create-tenant-webhook.dto';
import { TenantWebhookRepository } from '@app/modules/tenant-webhooks/repositories/tenant-webhook.repository';
import { TenantWebhookService } from '@app/modules/tenant-webhooks/services/tenant-webhook.service';
import { tenantWebhookSecretAad } from '@app/modules/tenant-webhooks/services/tenant-webhook-secret.util';

const KEYRING = `1:${randomBytes(32).toString('base64')}`;

function encryptedSecret(tenantId: string, endpointId: string, value: string) {
  return new ProviderCredentialCipher(KEYRING).encrypt(
    { secret_value: value },
    tenantWebhookSecretAad(tenantId, endpointId),
  );
}

function row(overrides: Partial<tenant_webhook_endpoints> = {}): tenant_webhook_endpoints {
  const encrypted = encryptedSecret('tenant-1', 'ep-1', 'OLD_SECRET_DO_NOT_LEAK');
  return {
    id: 'ep-1',
    tenant_id: 'tenant-1',
    url: 'https://api.example.test/billing/webhooks/payment-gateway-service',
    secret_ciphertext: encrypted.ciphertext,
    secret_iv: encrypted.iv,
    secret_tag: encrypted.tag,
    secret_key_version: encrypted.keyVersion,
    status: 'active',
    subscribed_events: ['payment.succeeded'],
    last_success_at: null,
    last_failure_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function setup(encryptionKeys = KEYRING) {
  const crypto = new ProviderCredentialCipher(encryptionKeys) as ProviderCredentialCryptoService;
  let current = row();
  const repository = {
    create: jest.fn(async (data: Partial<tenant_webhook_endpoints>) => {
      current = row({
        id: data.id,
        secret_ciphertext: data.secret_ciphertext,
        secret_iv: data.secret_iv,
        secret_tag: data.secret_tag,
        secret_key_version: data.secret_key_version,
        subscribed_events: data.subscribed_events,
        url: data.url,
      });
      return current;
    }),
    findPageByTenant: jest.fn(async () => [[current], 1]),
    findByIdForTenant: jest.fn(async (tenantId: string, id: string) =>
      tenantId === current.tenant_id && id === current.id ? current : null,
    ),
    update: jest.fn(async (_id: string, data: Partial<tenant_webhook_endpoints>) => {
      current = {
        ...current,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      };
      return current;
    }),
  };
  return {
    service: new TenantWebhookService(repository as unknown as TenantWebhookRepository, crypto),
    repository,
    current: () => current,
    crypto,
  };
}

describe('TenantWebhookService', () => {
  it('list / update KHÔNG bao giờ trả secret_value', async () => {
    const { service } = setup();

    const listed = (await service.list('tenant-1', new PaginationQueryDto())).content;
    const updated = await service.update('tenant-1', 'ep-1', {
      subscribedEvents: ['payment.succeeded', 'payment.refunded'],
    });

    expect(JSON.stringify(listed)).not.toContain('OLD_SECRET_DO_NOT_LEAK');
    expect(JSON.stringify(updated)).not.toContain('OLD_SECRET_DO_NOT_LEAK');
    expect(updated.subscribed_events).toEqual(['payment.succeeded', 'payment.refunded']);
  });

  it('rotate-secret -> secret mới chỉ trả một lần (raw_secret), row lưu ciphertext', async () => {
    const { service, current, crypto } = setup();

    const rotated = await service.rotateSecret('tenant-1', 'ep-1');

    expect(rotated.raw_secret).toMatch(/^[0-9a-f]{48}$/);
    expect(current().secret_ciphertext).not.toBe(rotated.raw_secret);
    expect(
      crypto.decrypt(
        {
          ciphertext: current().secret_ciphertext,
          iv: current().secret_iv,
          tag: current().secret_tag,
          keyVersion: current().secret_key_version,
        },
        tenantWebhookSecretAad(current().tenant_id, current().id),
      ).secret_value,
    ).toBe(rotated.raw_secret);
    expect(rotated).not.toHaveProperty('secret_value');
  });

  it('endpoint của tenant khác -> 404', async () => {
    const { service } = setup();
    await expect(service.update('tenant-2', 'ep-1', { status: 'paused' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.rotateSecret('tenant-2', 'ep-1')).rejects.toMatchObject({ status: 404 });
  });

  it('không tạo secret khi thiếu keyring mã hóa', async () => {
    const { service } = setup('');
    await expect(
      service.create('tenant-1', {
        url: 'https://api.example.com/webhooks',
        subscribedEvents: ['payment.succeeded'],
      }),
    ).rejects.toMatchObject({
      status: 500,
      definition: { code: 'PAYMENT.WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE' },
    });
  });

  it('create trả raw_secret một lần và lưu ciphertext', async () => {
    const { service, current, crypto } = setup();
    const created = await service.create('tenant-1', {
      url: 'https://x.vn/hook',
      subscribedEvents: ['payment.succeeded'],
    });
    expect(created.raw_secret).toBeTruthy();
    expect(created).not.toHaveProperty('secret_value');
    expect(current().secret_ciphertext).not.toBe(created.raw_secret);
    expect(
      crypto.decrypt(
        {
          ciphertext: current().secret_ciphertext,
          iv: current().secret_iv,
          tag: current().secret_tag,
          keyVersion: current().secret_key_version,
        },
        tenantWebhookSecretAad(current().tenant_id, current().id),
      ).secret_value,
    ).toBe(created.raw_secret);
  });
});

describe('DTO tenant webhook — kiểm PAYMENT_EVENT_TYPES', () => {
  it('loại sự kiện lạ -> lỗi; loại hợp lệ -> qua', async () => {
    const bad = await validate(
      plainToInstance(UpdateTenantWebhookDto, {
        subscribedEvents: ['payment.succeeded', 'payment.hacked'],
      }),
    );
    const good = await validate(
      plainToInstance(UpdateTenantWebhookDto, {
        subscribedEvents: [
          'payment.succeeded',
          'payment.extra_capture',
          'payment.partially_refunded',
        ],
      }),
    );
    expect(bad.length).toBeGreaterThan(0);
    expect(good).toHaveLength(0);
  });

  it('create: url phải http(s), danh sách không rỗng', async () => {
    expect(
      await validate(
        plainToInstance(CreateTenantWebhookDto, {
          url: 'ftp://x',
          subscribedEvents: ['payment.succeeded'],
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateTenantWebhookDto, { url: 'https://x.vn', subscribedEvents: [] }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateTenantWebhookDto, {
          url: 'http://localhost:9998/billing/webhooks/payment-gateway-service',
          subscribedEvents: ['payment.failed'],
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateTenantWebhookDto, {
          url: 'https://127.0.0.1:9998/billing/webhooks/payment-gateway-service',
          subscribedEvents: ['payment.failed'],
        }),
      ),
    ).not.toHaveLength(0);
  });
});
