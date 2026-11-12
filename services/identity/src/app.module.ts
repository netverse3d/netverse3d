import { Module } from '@nestjs/common';
import { CoreModule } from './common/core.module';
import { HealthModule } from '@netverse/nest-kit';
import { TenancyModule } from './modules/tenancy/tenancy.module';

@Module({
  imports: [CoreModule, HealthModule, TenancyModule],
})
export class AppModule {}
