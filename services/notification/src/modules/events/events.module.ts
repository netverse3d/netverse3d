import { Module } from '@nestjs/common';
import { EventConsumer } from '@netverse/nest-kit';
import { AppConfig } from '../../config/app-config';
import { NotificationsModule } from '../notifications/notifications.module';
import { createEventConsumer } from './event-consumer.factory';
import { ProcessedEventsRepository } from './repositories/processed-events.repository';
import { EventIntakeService } from './services/event-intake.service';

@Module({
  imports: [NotificationsModule],
  providers: [
    {
      provide: EventConsumer,
      useFactory: createEventConsumer,
      inject: [AppConfig, ProcessedEventsRepository],
    },
    EventIntakeService,
    ProcessedEventsRepository,
  ],
  exports: [EventConsumer],
})
export class EventsModule {}
