import { Module } from '@nestjs/common';
import { TenantAdminController } from './controllers/tenant-admin.controller';
import { TenantRepository } from './repositories/tenant.repository';
import { TenantService } from './services/tenant.service';

@Module({
  controllers: [TenantAdminController],
  providers: [TenantRepository, TenantService],
  exports: [TenantRepository, TenantService],
})
export class TenantsModule {}
