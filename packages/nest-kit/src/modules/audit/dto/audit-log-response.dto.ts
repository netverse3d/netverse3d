import { ApiProperty } from '@nestjs/swagger';
import type { AuditLogRow } from '../../../infrastructure/database/database';

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;

  @ApiProperty({ type: String, nullable: true })
  requestId: string | null;

  @ApiProperty({ type: String, nullable: true })
  tenantId: string | null;

  @ApiProperty({ type: String, nullable: true })
  actorSubject: string | null;

  @ApiProperty({ type: [String] })
  actorRoles: string[];

  @ApiProperty({ type: String, nullable: true })
  ip: string | null;

  @ApiProperty()
  action: string;

  @ApiProperty()
  resourceType: string;

  @ApiProperty({ type: String, nullable: true })
  resourceId: string | null;

  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] })
  outcome: string;

  @ApiProperty({ type: String, nullable: true })
  errorCode: string | null;

  @ApiProperty({ type: Object })
  metadata: unknown;

  static from(row: AuditLogRow): AuditLogResponseDto {
    return {
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      requestId: row.requestId,
      tenantId: row.tenantId,
      actorSubject: row.actorSubject,
      actorRoles: row.actorRoles,
      ip: row.ip,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      outcome: row.outcome,
      errorCode: row.errorCode,
      metadata: row.metadata,
    };
  }
}
