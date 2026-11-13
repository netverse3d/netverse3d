import { Module } from '@nestjs/common';
import { BlockedAddressesController } from './controllers/blocked-addresses.controller';
import { PreferencesController } from './controllers/preferences.controller';
import { PreferencesRepository } from './repositories/preferences.repository';
import { PreferencesService } from './services/preferences.service';

@Module({
  controllers: [PreferencesController, BlockedAddressesController],
  providers: [PreferencesRepository, PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
