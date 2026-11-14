import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import {
  ProviderAccountCreateInput,
  provider_accounts,
} from '@app/infrastructure/prisma/prisma.types';
import { uniqueViolation } from '@test/support/prisma-errors';
import { randomBytes } from 'crypto';
import {
  ProviderCredentialCipher,
  ProviderCredentialCryptoService,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { FakePaymentProvider } from '@test/fakes/fake-payment-provider';
import { PaymentProvider } from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { ProviderAccountRepository } from '@app/modules/provider-accounts/repositories/provider-account.repository';
import { ProviderAccountResolver } from '@app/modules/provider-accounts/services/provider-account-resolver.service';
import { ProviderAccountService } from '@app/modules/provider-accounts/services/provider-account.service';

const SECRET_VALUE = 'VNPAY_HASH_SECRET_DO_NOT_LEAK';

function realProvider(): PaymentProvider {
  return new FakePaymentProvider({
    code: 'vnpay',
    capabilities: { plaintextCredentialsAllowed: false, requiresWebhookSecret: true },
    validateAccount: ({ externalAccountRef, credentials }) => [
      ...(externalAccountRef ? [] : ['externalAccountRef bat buoc']),
      ...(credentials && typeof credentials.hash_secret !== 'string'
        ? ['credentials.hash_secret bat buoc']
        : []),
    ],
  });
}

function setup(keys: string) {
  const rows = new Map<string, provider_accounts>();
  const repository = {
    create: jest.fn(async (data: ProviderAccountCreateInput) => {
      const row = {
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        credentials_ciphertext: null,
        credentials_iv: null,
        credentials_tag: null,
        credentials_key_version: null,
        external_account_ref: null,
        ...data,
      } as unknown as provider_accounts;
      rows.set(row.id, row);
      return row;
    }),
    findByIdForTenant: jest.fn(async (_tenantId: string, id: string) => rows.get(id) ?? null),
    findById: jest.fn(async (id: string) => rows.get(id) ?? null),
    findPageByTenant: jest.fn(async (tenantId: string) => {
      const page = [...rows.values()].filter((row) => row.tenant_id === tenantId);
      return [page, page.length];
    }),
    update: jest.fn(async (id: string, data: Partial<provider_accounts>) => {
      const row = {
        ...rows.get(id)!,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      } as provider_accounts;
      rows.set(id, row);
      return row;
    }),
    updateCredentials: jest.fn(async (id: string, data: Partial<provider_accounts>) => {
      const row = { ...rows.get(id)!, ...data } as provider_accounts;
      rows.set(id, row);
      return row;
    }),
  };
  const crypto = new ProviderCredentialCipher(keys) as ProviderCredentialCryptoService;
  const providers = [new FakePaymentProvider(), realProvider()];
  const registry = {
    get: (code: string) => providers.find((p) => p.code === code)!,
  } as unknown as PaymentProviderRegistry;
  const service = new ProviderAccountService(
    repository as unknown as ProviderAccountRepository,
    crypto,
    registry,
  );
  const resolver = new ProviderAccountResolver(
    repository as unknown as ProviderAccountRepository,
    crypto,
  );
  return { service, resolver, repository, rows };
}

const KEYS = `1:${randomBytes(32).toString('base64')}`;

describe('ProviderAccountService', () => {
  it('có keyring -> mã hoá, credentials_json = {}, response KHÔNG chứa secret', async () => {
    const { service, repository, resolver, rows } = setup(KEYS);

    const view = await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'vnpay-prod',
      externalAccountRef: 'DEMOV210',
      credentials: { hash_secret: SECRET_VALUE },
    });

    const stored = repository.create.mock.calls[0]![0];
    expect(stored.credentials_json).toEqual({});
    expect(stored.credentials_ciphertext).toEqual(expect.any(String));
    expect(JSON.stringify(stored)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(view)).not.toContain(SECRET_VALUE);
    expect(view).toMatchObject({
      external_account_ref: 'DEMOV210',
      credentials: { storage: 'encrypted', key_version: 1 },
    });
    expect(resolver.toContext(rows.get(view.id)!)?.credentials).toEqual({
      hash_secret: SECRET_VALUE,
    });
  });

  it('KHÔNG có keyring + provider thật -> từ chối, không ghi DB', async () => {
    const { service, repository } = setup('');

    await expect(
      service.create('tenant-1', {
        providerCode: 'vnpay',
        accountLabel: 'x',
        externalAccountRef: 'TMN9',
        credentials: { hash_secret: SECRET_VALUE },
      }),
    ).rejects.toMatchObject({ status: 500 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('KHÔNG có keyring + provider test -> cho lưu plaintext (tương thích cũ) nhưng response chỉ có TÊN key', async () => {
    const { service } = setup('');

    const view = await service.create('tenant-1', {
      providerCode: 'fake',
      accountLabel: 'fake',
      credentials: { webhook_secret: 's3cret' },
    });

    expect(view.credentials).toEqual({
      storage: 'plaintext',
      key_version: null,
      plaintext_keys: ['webhook_secret'],
    });
    expect(JSON.stringify(view)).not.toContain('s3cret');
  });

  it('trùng account label / external ref (P2002) -> 409', async () => {
    const { service, repository } = setup(KEYS);
    repository.create.mockRejectedValueOnce(uniqueViolation());

    await expect(
      service.create('tenant-1', { providerCode: 'fake', accountLabel: 'x', credentials: {} }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('backfill mã hoá account plaintext cũ: xoá plaintext, resolver vẫn đọc được secret', async () => {
    const plain = setup('');
    const created = await plain.service.create('tenant-1', {
      providerCode: 'fake',
      accountLabel: 'm',
      credentials: { webhook_secret: 'old' },
    });

    const crypto = new ProviderCredentialCipher(KEYS) as ProviderCredentialCryptoService;
    const withKeys = new ProviderAccountService(
      plain.repository as unknown as ProviderAccountRepository,
      crypto,
      { get: () => new FakePaymentProvider() } as unknown as PaymentProviderRegistry,
    );
    const view = await withKeys.encryptExistingCredentials('tenant-1', created.id);

    const row = plain.rows.get(created.id)!;
    expect(row.credentials_json).toEqual({});
    expect(view.credentials.storage).toBe('encrypted');
    expect(
      new ProviderAccountResolver(
        plain.repository as unknown as ProviderAccountRepository,
        crypto,
      ).toContext(row)?.credentials,
    ).toEqual({
      webhook_secret: 'old',
    });
  });
});

describe('ProviderAccountService — quản trị account (C12)', () => {
  it('list -> mọi account, KHÔNG chứa credential', async () => {
    const { service } = setup(KEYS);
    await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'a',
      externalAccountRef: 'TMN1',
      credentials: { hash_secret: SECRET_VALUE },
    });
    await service.create('tenant-2', {
      providerCode: 'vnpay',
      accountLabel: 'b',
      externalAccountRef: 'TMN2',
      credentials: { hash_secret: SECRET_VALUE },
    });

    const views = (await service.list('tenant-1', new PaginationQueryDto())).content;

    expect(views).toHaveLength(1);
    expect(JSON.stringify(views)).not.toContain(SECRET_VALUE);
    expect(views[0]).toMatchObject({
      external_account_ref: 'TMN1',
      credentials: { storage: 'encrypted' },
    });
  });

  it('validateAccount báo lỗi -> 422 INVALID_PROVIDER_ACCOUNT, không ghi DB', async () => {
    const { service, repository } = setup(KEYS);

    await expect(
      service.create('tenant-1', { providerCode: 'vnpay', accountLabel: 'x', credentials: {} }),
    ).rejects.toMatchObject({ status: 422, details: { reason: 'INVALID_PROVIDER_ACCOUNT' } });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('PATCH status disabled -> đổi trạng thái, response không có credential', async () => {
    const { service } = setup(KEYS);
    const created = await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'a',
      externalAccountRef: 'TMN1',
      credentials: { hash_secret: SECRET_VALUE },
    });

    const view = await service.update('tenant-1', created.id, { status: 'disabled' });

    expect(view.status).toBe('disabled');
    expect(JSON.stringify(view)).not.toContain(SECRET_VALUE);
  });

  it('PATCH account của tenant khác -> 404', async () => {
    const { service, repository } = setup(KEYS);
    const created = await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'a',
      externalAccountRef: 'TMN1',
      credentials: { hash_secret: SECRET_VALUE },
    });
    repository.findByIdForTenant.mockImplementation(async (tenantId: string, id: string) =>
      tenantId === 'tenant-1' && id === created.id ? await repository.findById(id) : null,
    );

    await expect(
      service.update('tenant-2', created.id, { status: 'disabled' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PUT credentials -> mã hoá lại, resolver đọc được secret mới, response không lộ secret', async () => {
    const { service, resolver, rows } = setup(KEYS);
    const created = await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'a',
      externalAccountRef: 'TMN1',
      credentials: { hash_secret: 'old-secret' },
    });

    const view = await service.replaceCredentials('tenant-1', created.id, {
      credentials: { hash_secret: SECRET_VALUE },
    });

    expect(JSON.stringify(view)).not.toContain(SECRET_VALUE);
    expect(rows.get(created.id)!.credentials_json).toEqual({});
    expect(resolver.toContext(rows.get(created.id)!)?.credentials).toEqual({
      hash_secret: SECRET_VALUE,
    });
  });

  it('PUT credentials sai hình dạng -> 422, giữ credential cũ', async () => {
    const { service, resolver, rows } = setup(KEYS);
    const created = await service.create('tenant-1', {
      providerCode: 'vnpay',
      accountLabel: 'a',
      externalAccountRef: 'TMN1',
      credentials: { hash_secret: 'old-secret' },
    });

    await expect(
      service.replaceCredentials('tenant-1', created.id, { credentials: { other: 1 } }),
    ).rejects.toMatchObject({ status: 422 });
    expect(resolver.toContext(rows.get(created.id)!)?.credentials).toEqual({
      hash_secret: 'old-secret',
    });
  });
});
