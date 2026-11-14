import { Injectable } from '@nestjs/common';
import { PageResponseDto } from '@app/common/pagination/page-response.dto';
import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';
import { resolveSort } from '@app/common/pagination/resolve-sort';
import { toColumnSort } from '@app/common/pagination/to-column-sort';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { InputJson, JSON_NULL } from '@app/infrastructure/prisma/prisma.types';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { TenantRepository } from '../repositories/tenant.repository';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'code', 'name'] as const;

@Injectable()
export class TenantService {
  constructor(private readonly repository: TenantRepository) {}

  async list(query: PaginationQueryDto) {
    const orderBy = toColumnSort(resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' }));
    const [rows, total] = await this.repository.findPage(orderBy, query.skip, query.take);
    return PageResponseDto.of(rows, query, total);
  }

  findByCode(code: string) {
    return this.repository.findByCode(code);
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.repository.findByCode(dto.code);
    if (existing)
      throw new AppException(PaymentErrorCode.TENANT_CODE_TAKEN, {
        message: `Tenant code "${dto.code}" already exists`,
      });
    return this.repository.create({
      code: dto.code,
      name: dto.name,
      default_currency: (dto.defaultCurrency ?? 'VND').toUpperCase(),
      metadata_json: dto.metadata ? (dto.metadata as InputJson) : JSON_NULL,
    });
  }

  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.repository.findById(id);
    if (!tenant) throw new AppException(PaymentErrorCode.TENANT_NOT_FOUND);
    return this.repository.update(id, {
      code: dto.code,
      name: dto.name,
      default_currency: dto.defaultCurrency?.toUpperCase(),
      metadata_json: dto.metadata ? (dto.metadata as InputJson) : undefined,
    });
  }
}
