import { Module } from '@nestjs/common';
import { CoreModule } from './common/core.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { StorageService } from './infrastructure/storage/storage.service';
import { HealthModule } from '@netverse/nest-kit';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    CoreModule,
    StorageModule,
    HealthModule.withProbes({
      inject: [StorageService],
      useFactory: (storage: StorageService) => [() => storage.ping()],
    }),
    MediaModule,
  ],
})
export class AppModule {}
