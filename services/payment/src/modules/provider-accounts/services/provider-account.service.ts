import { Injectable, Logger } from '@nestjs/common';
import { PageResponseDto } from '@netverse/nest-kit';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { resolveSort } from '@app/common/pagination/resolve-sort';
import { toColumnSort } from '@app/common/pagination/to-column-sort';
import {
  InputJson,
  JSON_NULL,
  isUniqueViolation,
  provider_accounts,
} from '@app/infrastructure/prisma/prisma.types';
import { randomUUID } from 'crypto';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import {
  PaymentProvider,
  ProviderAccountValidationInput,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { PaymentProviderRegistry } from '@app/modules/providers/registry/payment-provider.registry';
import { CreateProviderAccountDto } from '../dto/create-provider-account.dto';
import {
  ReplaceProviderCredentialsDto,
  UpdateProviderAccountDto,
} from '../dto/update-provider-account.dto';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';
import { credentialAad } from './provider-account-resolver.service';

type CredentialStorage = {
  credentials_json: InputJson;
  credentials_ciphertext: string | null;
  credentials_iv: string | null;
  credentials_tag: string | null;
  credentials_key_version: number | null;
};

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'providerCode'] as const;

@Injectable()
export class ProviderAccountService {
  private readonly logger = new Logger(ProviderAccountService.name);

  constructor(
    private readonly repository: ProviderAccountRepository,
    private readonly crypto: ProviderCredentialCryptoService,
    private readonly providerRegistry: PaymentProviderRegistry,
  ) {}

  async create(tenantId: string, dto: CreateProviderAccountDto) {
    const provider = this.providerRegistry.get(dto.providerCode);
    this.validate(provider, {
      externalAccountRef: dto.externalAccountRef ?? null,
      credentials: dto.credentials,
      config: dto.config ?? null,
    });
    const id = randomUUID();
    const storage = this.credentialStorage(
      id,
      dto.providerCode,
      provider.capabilities().plaintextCredentialsAllowed,
      dto.credentials,
    );

    try {
      const row = await this.repository.create({
        id,
        tenant_id: tenantId,
        provider_code: dto.providerCode,
        account_label: dto.accountLabel,
        external_account_ref: dto.externalAccountRef ?? null,
        config_json: dto.config ? (dto.config as InputJson) : JSON_NULL,
        ...storage,
      });
      return this.toView(row);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async list(tenantId: string, query: PaginationQueryDto) {
    const orderBy = query.sort
      ? toColumnSort(resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' }))
      : undefined;
    const [rows, total] = await this.repository.findPageByTenant(
      tenantId,
      orderBy,
      query.skip,
      query.take,
    );
    return PageResponseDto.of(
      rows.map((row) => this.toView(row)),
      query,
      total,
    );
  }

  activeProviderCodes(tenantId: string) {
    return this.repository.findActiveProviderCodes(tenantId);
  }

  async update(tenantId: string, accountId: string, dto: UpdateProviderAccountDto) {
    const row = await this.requireAccount(tenantId, accountId);
    if (dto.config !== undefined) {
      this.validate(this.providerRegistry.get(row.provider_code), {
        externalAccountRef: row.external_account_ref,
        config: dto.config,
      });
    }
    try {
      const updated = await this.repository.update(row.id, {
        status: dto.status,
        account_label: dto.accountLabel,
        config_json: dto.config === undefined ? undefined : (dto.config as InputJson),
      });
      return this.toView(updated);
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async replaceCredentials(
    tenantId: string,
    accountId: string,
    dto: ReplaceProviderCredentialsDto,
  ) {
    const row = await this.requireAccount(tenantId, accountId);
    const provider = this.providerRegistry.get(row.provider_code);
    this.validate(provider, {
      externalAccountRef: row.external_account_ref,
      credentials: dto.credentials,
      config: asObject(row.config_json),
    });
    const storage = this.credentialStorage(
      row.id,
      row.provider_code,
      provider.capabilities().plaintextCredentialsAllowed,
      dto.credentials,
    );
    return this.toView(await this.repository.updateCredentials(row.id, storage));
  }

  async encryptExistingCredentials(tenantId: string, accountId: string) {
    const row = await this.requireAccount(tenantId, accountId);
    if (row.credentials_ciphertext) return this.toView(row);
    if (!this.crypto.isConfigured()) {
      throw new AppException(PaymentErrorCode.CREDENTIALS_ENCRYPTION_UNAVAILABLE);
    }
    const encrypted = this.crypto.encrypt(asObject(row.credentials_json), credentialAad(row.id));
    const updated = await this.repository.updateCredentials(row.id, {
      credentials_json: {},
      credentials_ciphertext: encrypted.ciphertext,
      credentials_iv: encrypted.iv,
      credentials_tag: encrypted.tag,
      credentials_key_version: encrypted.keyVersion,
    });
    return this.toView(updated);
  }

  toView(row: provider_accounts) {
    const encrypted = !!row.credentials_ciphertext;
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      provider_code: row.provider_code,
      account_label: row.account_label,
      external_account_ref: row.external_account_ref,
      status: row.status,
      config_json: row.config_json,
      credentials: {
        storage: encrypted ? ('encrypted' as const) : ('plaintext' as const),
        key_version: row.credentials_key_version,
        plaintext_keys: encrypted ? [] : Object.keys(asObject(row.credentials_json)),
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async requireAccount(tenantId: string, accountId: string) {
    const row = await this.repository.findByIdForTenant(tenantId, accountId);
    if (!row) throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_NOT_FOUND);
    return row;
  }

  private validate(provider: PaymentProvider, input: ProviderAccountValidationInput) {
    const problems = provider.validateAccount?.(input) ?? [];
    if (problems.length > 0) {
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_INVALID, {
        message: `Account configuration for "${provider.code}" is invalid`,
        details: { reason: 'INVALID_PROVIDER_ACCOUNT', problems },
      });
    }
  }

  private translateUniqueViolation(error: unknown) {
    if (isUniqueViolation(error)) {
      return new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_EXISTS);
    }
    return error;
  }

  private credentialStorage(
    accountId: string,
    providerCode: string,
    plaintextAllowed: boolean,
    credentials: Record<string, unknown>,
  ): CredentialStorage {
    if (this.crypto.isConfigured()) {
      const encrypted = this.crypto.encrypt(credentials, credentialAad(accountId));
      return {
        credentials_json: {},
        credentials_ciphertext: encrypted.ciphertext,
        credentials_iv: encrypted.iv,
        credentials_tag: encrypted.tag,
        credentials_key_version: encrypted.keyVersion,
      };
    }
    if (!plaintextAllowed) {
      throw new AppException(PaymentErrorCode.CREDENTIALS_ENCRYPTION_UNAVAILABLE, {
        message: `Provider credential encryption is not configured: refusing to store "${providerCode}" credentials in plaintext`,
      });
    }
    this.logger.warn(
      `Provider account "${providerCode}" stores credentials in plaintext because PROVIDER_CREDENTIALS_KEYS is not configured; acceptable only for test providers`,
    );
    return {
      credentials_json: credentials as InputJson,
      credentials_ciphertext: null,
      credentials_iv: null,
      credentials_tag: null,
      credentials_key_version: null,
    };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
