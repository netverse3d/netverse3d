import { Injectable } from '@nestjs/common';
import { provider_accounts } from '@app/infrastructure/prisma/prisma.types';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { ProviderAccountContext } from '@app/modules/providers/contracts/payment-provider.contract';
import { ProviderAccountRepository } from '../repositories/provider-account.repository';

export function credentialAad(accountId: string) {
  return `provider_account:${accountId}`;
}

@Injectable()
export class ProviderAccountResolver {
  constructor(
    private readonly repository: ProviderAccountRepository,
    private readonly crypto: ProviderCredentialCryptoService,
  ) {}

  async byId(id: string) {
    return this.toContext(await this.repository.findById(id));
  }

  async activeByTenant(tenantId: string, providerCode: string) {
    return this.toContext(await this.repository.findActiveByTenantAndCode(tenantId, providerCode));
  }

  async byExternalRef(providerCode: string, externalAccountRef: string) {
    return this.toContext(
      await this.repository.findByExternalRef(providerCode, externalAccountRef),
    );
  }

  toContext(row: provider_accounts | null): ProviderAccountContext | null {
    if (!row) return null;
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      externalAccountRef: row.external_account_ref,
      credentials: this.credentials(row),
      config: isObject(row.config_json) ? row.config_json : null,
    };
  }

  private credentials(row: provider_accounts): Record<string, unknown> {
    if (
      row.credentials_ciphertext &&
      row.credentials_iv &&
      row.credentials_tag &&
      row.credentials_key_version
    ) {
      return this.crypto.decrypt(
        {
          ciphertext: row.credentials_ciphertext,
          iv: row.credentials_iv,
          tag: row.credentials_tag,
          keyVersion: row.credentials_key_version,
        },
        credentialAad(row.id),
      );
    }
    return isObject(row.credentials_json) ? row.credentials_json : {};
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
