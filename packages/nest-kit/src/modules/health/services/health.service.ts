import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-code';
import { KitConfig } from '../../../config/kit-config';
import { Database } from '../../../infrastructure/database/database';
import { HealthResponseDto } from '../dto/health-response.dto';
import { HEALTH_PROBES, HealthProbe } from '../health-probe';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly config: KitConfig,
    private readonly database: Database,
    @Inject(HEALTH_PROBES) private readonly probes: HealthProbe[],
  ) {}

  live(): HealthResponseDto {
    return { status: 'ok', version: this.config.service.version };
  }

  async ready(): Promise<HealthResponseDto> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      for (const probe of this.probes) await probe();
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    }
    return this.live();
  }
}
