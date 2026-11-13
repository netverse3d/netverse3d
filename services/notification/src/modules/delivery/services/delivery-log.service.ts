import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { resolveSort } from '@netverse/nest-kit';
import { requireTenant } from '../../notifications/domain/require-tenant';
import { DeliveryLogEntryDto, DeliveryQueryDto } from '../dto/delivery.dto';
import { DeliveryRepository } from '../repositories/delivery.repository';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'status'] as const;

@Injectable()
export class DeliveryLogService {
  constructor(private readonly repository: DeliveryRepository) {}

  async list(query: DeliveryQueryDto, actor: Actor): Promise<PageResponseDto<DeliveryLogEntryDto>> {
    const orderBy = resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' });
    const [rows, total] = await this.repository.findPage(
      requireTenant(actor),
      { status: query.status, eventType: query.eventType },
      orderBy,
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(DeliveryLogEntryDto.from), query, total);
  }
}
