import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import { listTenantPage } from '@app/common/pagination/list-tenant-page';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { sha256 } from '@app/common/utils/hash.util';
import { randomBytes } from 'crypto';
import { TenantRepository } from '@app/modules/tenants/repositories/tenant.repository';
import { CreateTenantApiKeyDto } from '../dto/create-tenant-api-key.dto';
import { TenantApiKeyRepository } from '../repositories/tenant-api-key.repository';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt'] as const;

type TenantApiKeyRow = Awaited<ReturnType<TenantApiKeyRepository['create']>>;

function toApiKeyView(row: TenantApiKeyRow) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    key_prefix: row.key_prefix,
    label: row.label,
    status: row.status,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

@Injectable()
export class TenantApiKeyService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly repository: TenantApiKeyRepository,
  ) {}

  async listByTenant(tenantId: string, query: PaginationQueryDto) {
    return listTenantPage(
      tenantId,
      query,
      SORTABLE_FIELDS,
      { createdAt: 'desc' },
      this.repository.findPageByTenant.bind(this.repository),
      toApiKeyView,
    );
  }

  async create(tenantId: string, dto: CreateTenantApiKeyDto) {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) throw new AppException(PaymentErrorCode.TENANT_NOT_FOUND);

    const prefix = `pk_${randomBytes(4).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const rawApiKey = `${prefix}.${secret}`;

    const record = await this.repository.create({
      key_prefix: prefix,
      secret_hash: sha256(secret),
      label: dto.label,
      tenants: { connect: { id: tenantId } },
    });

    return {
      ...toApiKeyView(record),
      raw_api_key: rawApiKey,
    };
  }
}
