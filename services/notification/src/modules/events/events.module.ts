import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NoneEventConsumer } from './adapters/none-event-consumer';
import { EventConsumer } from './ports/event-consumer';
import { EventIntakeService } from './services/event-intake.service';

@Module({
  imports: [NotificationsModule],
  providers: [{ provide: EventConsumer, useClass: NoneEventConsumer }, EventIntakeService],
  exports: [EventConsumer],
})
export class EventsModule {}
