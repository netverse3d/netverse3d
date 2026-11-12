import { Injectable } from '@nestjs/common';
import {
  AuditLogRow,
  Database,
  DatabaseTransaction,
} from '../../../infrastructure/database/database';

export type AuditTransaction = Pick<DatabaseTransaction, 'auditLog'>;

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditLogRecord {
  requestId: string | null;
  tenantId: string | null;
  actorSubject: string | null;
  actorRoles: string[];
  ip: string | null;
  userAgent: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  errorCode: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogFilter {
  tenantId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorSubject?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly database: Database) {}

  async insert(record: AuditLogRecord, client: AuditTransaction = this.database): Promise<void> {
    await client.auditLog.create({ data: record });
  }

  findPage(filter: AuditLogFilter, skip: number, take: number): Promise<[AuditLogRow[], number]> {
    const { from, to, ...exact } = filter;
    const where = {
      ...exact,
      ...(from || to ? { occurredAt: { gte: from, lte: to } } : {}),
    };
    return this.database.$transaction(async (transaction) => {
      const rows = await transaction.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { occurredAt: 'desc' },
      });
      const total = await transaction.auditLog.count({ where });
      return [rows, total];
    });
  }
}
