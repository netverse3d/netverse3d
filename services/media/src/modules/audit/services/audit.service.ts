import { Injectable, Logger } from '@nestjs/common';
import { Actor, currentRequestContext } from '../../../common/context/request-context';
import { PageResponseDto } from '../../../common/pagination/page-response.dto';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';
import { AuditLogRepository, AuditTransaction } from '../repositories/audit-log.repository';

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditLogRepository) {}

  async record(entry: AuditEntry, transaction?: AuditTransaction): Promise<void> {
    const context = currentRequestContext();
    await this.repository.insert(
      {
        requestId: context?.requestId ?? null,
        tenantId: context?.actor?.tenantId ?? null,
        actorSubject: context?.actor?.subject ?? null,
        actorRoles: [...(context?.actor?.roles ?? [])],
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        outcome: entry.outcome,
        errorCode: entry.errorCode ?? null,
        metadata: entry.metadata ?? {},
      },
      transaction,
    );
  }

  async recordWithoutFailing(entry: AuditEntry): Promise<void> {
    try {
      await this.record(entry);
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
    }
  }

  async list(query: AuditLogQueryDto, actor: Actor): Promise<PageResponseDto<AuditLogResponseDto>> {
    const [rows, total] = await this.repository.findPage(
      {
        ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
        ...(query.actorSubject ? { actorSubject: query.actorSubject } : {}),
        from: query.from,
        to: query.to,
      },
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(AuditLogResponseDto.from), query, total);
  }
}
