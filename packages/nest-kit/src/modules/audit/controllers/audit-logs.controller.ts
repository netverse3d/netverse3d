import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../common/context/request-context';
import { CurrentActor } from '../../../common/decorators/current-actor.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PageResponseDto } from '../../../common/pagination/page-response.dto';
import { ApiPagedEnvelope } from '../../../common/swagger/api-envelope.decorators';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';
import { AuditService } from '../services/audit.service';

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
