import { Module } from '@nestjs/common';
import { GrpcModule } from '@netverse/nest-kit';
import { TemplatesModule } from '../templates/templates.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationCommands } from './grpc/notification-commands';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';

@Module({
  imports: [TemplatesModule, GrpcModule],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, NotificationCommands],
  exports: [NotificationsService],
})
export class NotificationsModule {}
