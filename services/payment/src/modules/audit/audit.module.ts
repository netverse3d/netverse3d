import { Global, Module } from '@nestjs/common';
import {
  AuditInterceptor,
  AuditLogRepository as SharedAuditLogRepository,
  AuditService,
} from '@netverse/nest-kit';
import { AuditLogsController } from './controllers/audit-logs.controller';
import { PaymentAuditLogRepository } from './repositories/audit-log.repository';

@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [
    { provide: SharedAuditLogRepository, useClass: PaymentAuditLogRepository },
    AuditService,
    AuditInterceptor,
  ],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
