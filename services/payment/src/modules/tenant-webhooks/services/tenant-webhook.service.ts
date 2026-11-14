import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import { listTenantPage } from '@app/common/pagination/list-tenant-page';
import { tenant_webhook_endpoints } from '@app/infrastructure/prisma/prisma.types';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { tenantWebhookSecretAad } from './tenant-webhook-secret.util';
import { CreateTenantWebhookDto, UpdateTenantWebhookDto } from '../dto/create-tenant-webhook.dto';
import { TenantWebhookRepository } from '../repositories/tenant-webhook.repository';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt'] as const;

@Injectable()
export class TenantWebhookService {
  constructor(
    private readonly repository: TenantWebhookRepository,
    private readonly crypto: ProviderCredentialCryptoService,
  ) {}

  async create(tenantId: string, dto: CreateTenantWebhookDto) {
    this.ensureEncryptionConfigured();
    const secret = newSecret();
    const id = randomUUID();
    const encrypted = this.crypto.encrypt(
      { secret_value: secret },
      tenantWebhookSecretAad(tenantId, id),
    );
    const row = await this.repository.create({
      id,
      url: dto.url,
      secret_ciphertext: encrypted.ciphertext,
      secret_iv: encrypted.iv,
      secret_tag: encrypted.tag,
      secret_key_version: encrypted.keyVersion,
      subscribed_events: dto.subscribedEvents,
      tenants: { connect: { id: tenantId } },
    });
    return { ...toView(row), raw_secret: secret };
  }

  async list(tenantId: string, query: PaginationQueryDto) {
    return listTenantPage(
      tenantId,
      query,
      SORTABLE_FIELDS,
      { createdAt: 'asc' },
      this.repository.findPageByTenant.bind(this.repository),
      toView,
    );
  }

  async findByUrl(tenantId: string, url: string) {
    const row = await this.repository.findByTenantAndUrl(tenantId, url);
    return row ? toView(row) : null;
  }

  async update(tenantId: string, endpointId: string, dto: UpdateTenantWebhookDto) {
    const row = await this.requireEndpoint(tenantId, endpointId);
    const updated = await this.repository.update(row.id, {
      url: dto.url,
      subscribed_events: dto.subscribedEvents,
      status: dto.status,
    });
    return toView(updated);
  }

  async rotateSecret(tenantId: string, endpointId: string) {
    const row = await this.requireEndpoint(tenantId, endpointId);
    this.ensureEncryptionConfigured();
    const secret = newSecret();
    const encrypted = this.crypto.encrypt(
      { secret_value: secret },
      tenantWebhookSecretAad(tenantId, endpointId),
    );
    const updated = await this.repository.update(row.id, {
      secret_ciphertext: encrypted.ciphertext,
      secret_iv: encrypted.iv,
      secret_tag: encrypted.tag,
      secret_key_version: encrypted.keyVersion,
    });
    return { ...toView(updated), raw_secret: secret };
  }

  private async requireEndpoint(tenantId: string, endpointId: string) {
    const row = await this.repository.findByIdForTenant(tenantId, endpointId);
    if (!row) throw new AppException(PaymentErrorCode.WEBHOOK_ENDPOINT_NOT_FOUND);
    return row;
  }

  private ensureEncryptionConfigured() {
    if (!this.crypto.isConfigured()) {
      throw new AppException(PaymentErrorCode.WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE);
    }
  }
}

function newSecret() {
  return randomBytes(24).toString('hex');
}

function toView(row: tenant_webhook_endpoints) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    url: row.url,
    status: row.status,
    subscribed_events: row.subscribed_events,
    last_success_at: row.last_success_at,
    last_failure_at: row.last_failure_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
