import { Module } from '@nestjs/common';
import { OutboxModule } from '@netverse/nest-kit';
import { MediaController } from './controllers/media.controller';
import { HardDeleteReaper, PendingReaper, TemporaryReaper } from './jobs/media-reapers';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './services/media.service';

@Module({
  imports: [OutboxModule],
  controllers: [MediaController],
  providers: [MediaRepository, MediaService, PendingReaper, TemporaryReaper, HardDeleteReaper],
})
export class MediaModule {}
