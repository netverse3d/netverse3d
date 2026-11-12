import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-code';
import { AppConfig } from '../../../config/app-config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { HealthResponseDto } from '../dto/health-response.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  live(): HealthResponseDto {
    return { status: 'ok', version: this.config.service.version };
  }

  async ready(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.storage.ping();
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    }
    return this.live();
  }
}
