import { Injectable } from '@nestjs/common';
import { AuditLog, AuditOutcome, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type AuditTransaction = Prisma.TransactionClient;

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
  constructor(private readonly prisma: PrismaService) {}

  async insert(record: AuditLogRecord, client: AuditTransaction = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: { ...record, metadata: record.metadata as Prisma.InputJsonObject },
    });
  }

  async findPage(
    filter: AuditLogFilter,
    skip: number,
    take: number,
  ): Promise<[AuditLog[], number]> {
    const { from, to, ...exact } = filter;
    const where: Prisma.AuditLogWhereInput = {
      ...exact,
      ...(from || to ? { occurredAt: { gte: from, lte: to } } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, skip, take, orderBy: { occurredAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
  }
}
