import { Module } from '@nestjs/common';
import { KeysModule } from '../keys/keys.module';
import { ServiceClientsAdminController } from './controllers/service-clients-admin.controller';
import { ServiceTokenController } from './controllers/service-token.controller';
import { ServiceClientRepository } from './repositories/service-client.repository';
import { ServiceClientService } from './services/service-client.service';

@Module({
  imports: [KeysModule],
  controllers: [ServiceClientsAdminController, ServiceTokenController],
  providers: [ServiceClientRepository, ServiceClientService],
})
export class ServiceClientsModule {}
