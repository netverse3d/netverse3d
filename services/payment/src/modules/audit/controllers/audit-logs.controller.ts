import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogQueryDto, AuditLogResponseDto, PageResponseDto } from '@netverse/nest-kit';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { Roles } from '@netverse/nest-kit';
import { ApiPagedEnvelope } from '@netverse/nest-kit';
import { AuditService } from '@netverse/nest-kit';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('admin', 'platform_admin')
  @ApiOperation({ summary: 'List audit log entries, newest first' })
  @ApiPagedEnvelope(AuditLogResponseDto)
  list(
    @Query() query: AuditLogQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<AuditLogResponseDto>> {
    return this.audit.list(query, actor);
  }
}
