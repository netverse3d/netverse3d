import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { PageResponseDto } from '../common/pagination/page-response.dto';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { TENANT_ADMIN_ROLE } from '../infrastructure/auth/platform-roles';
import { Audit } from '../modules/audit/audit.decorator';

export const INTERNAL_ERROR_DETAIL = 'connection string leaked here';
export const PROBE_PERMISSION = 'probe:call';

class ProbeBodyDto {
  @IsString()
  @MinLength(2)
  name: string;
}

@ApiExcludeController()
@Controller('__probe')
export class ConformanceProbeController {
  @Get('ok')
  @Public()
  ok(): { value: number } {
    return { value: 1 };
  }

  @Get('paged')
  @Public()
  paged(@Query() query: PaginationQueryDto): PageResponseDto<{ index: number }> {
    return PageResponseDto.of([{ index: query.skip }], query, 45);
  }

  @Post('echo')
  @Public()
  echo(@Body() body: ProbeBodyDto): ProbeBodyDto {
    return body;
  }

  @Get('boom')
  @Public()
  boom(): never {
    throw new Error(INTERNAL_ERROR_DETAIL);
  }

  @Get('slow')
  @Public()
  slow(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  @Get('protected')
  protectedRoute(): { value: number } {
    return { value: 2 };
  }

  @Get('service-only')
  @Permissions(PROBE_PERMISSION)
  serviceOnly(): { value: number } {
    return { value: 3 };
  }

  @Get('admin-or-service')
  @Roles(TENANT_ADMIN_ROLE)
  @Permissions(PROBE_PERMISSION)
  adminOrService(): { value: number } {
    return { value: 4 };
  }

  @Post('audited-failure')
  @Audit({ action: 'probe.fail', resourceType: 'probe' })
  auditedFailure(): never {
    throw new AppException(ErrorCode.CONFLICT);
  }
}
