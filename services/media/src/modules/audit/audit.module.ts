import { Global, Module } from '@nestjs/common';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { AuditService } from './services/audit.service';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogRepository, AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
