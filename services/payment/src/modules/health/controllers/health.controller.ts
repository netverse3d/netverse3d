import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { HealthResponseDto } from '../dto/health-response.dto';
import { HealthService } from '../services/health.service';

@ApiTags('health')
@SkipThrottle()
@RawResponse()
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('livez')
  @Public()
  @ApiOperation({ summary: 'Report that the process is alive' })
  @ApiOkResponse({ type: HealthResponseDto })
  live(): HealthResponseDto {
    return this.health.live();
  }

  @Get('healthz')
  @Public()
  @ApiOperation({ summary: 'Report that the service and its required dependencies are ready' })
  @ApiOkResponse({ type: HealthResponseDto })
  ready(): Promise<HealthResponseDto> {
    return this.health.ready();
  }
}
