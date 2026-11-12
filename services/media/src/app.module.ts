import { Module } from '@nestjs/common';
import { CoreModule } from './common/core.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [CoreModule, StorageModule, HealthModule, MediaModule],
})
export class AppModule {}
