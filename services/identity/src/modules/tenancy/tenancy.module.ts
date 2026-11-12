import { Module } from '@nestjs/common';
import { OutboxModule } from '@netverse/nest-kit';
import { PrincipalsAdminController } from './controllers/principals-admin.controller';
import { TenantsController } from './controllers/tenants.controller';
import { TenancyRepository } from './repositories/tenancy.repository';
import { TenancyService } from './services/tenancy.service';

@Module({
  imports: [OutboxModule],
  controllers: [TenantsController, PrincipalsAdminController],
  providers: [TenancyRepository, TenancyService],
})
export class TenancyModule {}
