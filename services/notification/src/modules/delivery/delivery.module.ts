import { Module } from '@nestjs/common';
import { BrandingModule } from '../branding/branding.module';
import { ChannelsModule } from '../channels/channels.module';
import { OutboxModule } from '@netverse/nest-kit';
import { PreferencesModule } from '../preferences/preferences.module';
import { TemplatesModule } from '../templates/templates.module';
import { DeliveriesController } from './controllers/deliveries.controller';
import { DeliveryDispatchJob } from './jobs/delivery-dispatch.job';
import { DeliveryRepository } from './repositories/delivery.repository';
import { DeliveryDispatcherService } from './services/delivery-dispatcher.service';
import { DeliveryLogService } from './services/delivery-log.service';

@Module({
  imports: [OutboxModule, ChannelsModule, TemplatesModule, BrandingModule, PreferencesModule],
  controllers: [DeliveriesController],
  providers: [
    DeliveryRepository,
    DeliveryDispatcherService,
    DeliveryLogService,
    DeliveryDispatchJob,
  ],
})
export class DeliveryModule {}
