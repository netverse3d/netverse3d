import { Module } from '@nestjs/common';
import { EventConsumer, GrpcModule, GrpcServer, HealthModule } from '@netverse/nest-kit';
import { CoreModule } from './common/core.module';
import { BrandingModule } from './modules/branding/branding.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { EventsModule } from './modules/events/events.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [
    CoreModule,
    HealthModule.withProbes({
      imports: [EventsModule, GrpcModule],
      inject: [EventConsumer, GrpcServer],
      useFactory: (events: EventConsumer, grpc: GrpcServer) => [
        () =>
          grpc.isServing()
            ? Promise.resolve()
            : Promise.reject(new Error('The gRPC server is not listening')),
        () =>
          events.isHealthy()
            ? Promise.resolve()
            : Promise.reject(new Error('Event consumer is not connected')),
      ],
    }),
    TemplatesModule,
    BrandingModule,
    PreferencesModule,
    InboxModule,
    NotificationsModule,
    DeliveryModule,
    EventsModule,
  ],
})
export class AppModule {}
