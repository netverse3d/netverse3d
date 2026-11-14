import { Module } from '@nestjs/common';
import { TenantsModule } from '@app/modules/tenants/tenants.module';
import { TenantApiKeyAdminController } from './controllers/tenant-api-key-admin.controller';
import { TenantApiKeyRepository } from './repositories/tenant-api-key.repository';
import { TenantApiKeyService } from './services/tenant-api-key.service';

@Module({
  imports: [TenantsModule],
  controllers: [TenantApiKeyAdminController],
  providers: [TenantApiKeyRepository, TenantApiKeyService],
  exports: [TenantApiKeyRepository, TenantApiKeyService],
})
export class TenantApiKeysModule {}
