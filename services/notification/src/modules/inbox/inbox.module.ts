import { Module } from '@nestjs/common';
import { InboxController } from './controllers/inbox.controller';
import { InboxRepository } from './repositories/inbox.repository';
import { InboxService } from './services/inbox.service';

@Module({
  controllers: [InboxController],
  providers: [InboxRepository, InboxService],
  exports: [InboxRepository],
})
export class InboxModule {}
