import { Module } from '@nestjs/common';
import { EventConsumer, NoneEventConsumer } from '@netverse/nest-kit';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventIntakeService } from './services/event-intake.service';

@Module({
  imports: [NotificationsModule],
  providers: [{ provide: EventConsumer, useClass: NoneEventConsumer }, EventIntakeService],
  exports: [EventConsumer],
})
export class EventsModule {}
