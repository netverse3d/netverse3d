import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { Public } from '../../src/common/decorators/public.decorator';
import { AppException } from '../../src/common/errors/app.exception';
import { ErrorCode } from '../../src/common/errors/error-code';
import { PageResponseDto } from '../../src/common/pagination/page-response.dto';
import { PaginationQueryDto } from '../../src/common/pagination/pagination-query.dto';
import { Audit } from '../../src/modules/audit/audit.decorator';

export const INTERNAL_ERROR_DETAIL = 'connection string leaked here';

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

  @Post('audited-failure')
  @Audit({ action: 'probe.fail', resourceType: 'probe' })
  auditedFailure(): never {
    throw new AppException(ErrorCode.CONFLICT);
  }
}
