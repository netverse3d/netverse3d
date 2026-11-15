import { Injectable } from '@nestjs/common';
import { AuditLogRepository as SharedAuditLogRepository, Database } from '@netverse/nest-kit';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class PaymentAuditLogRepository extends SharedAuditLogRepository {
  constructor(prisma: PrismaService) {
    super(prisma as unknown as Database);
  }
}
