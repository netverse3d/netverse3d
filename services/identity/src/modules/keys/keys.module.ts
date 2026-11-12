import { Module } from '@nestjs/common';
import { JwksController } from './controllers/jwks.controller';
import { KeysAdminController } from './controllers/keys-admin.controller';
import { SigningKeyRepository } from './repositories/signing-key.repository';
import { KeysService } from './services/keys.service';

@Module({
  controllers: [JwksController, KeysAdminController],
  providers: [SigningKeyRepository, KeysService],
  exports: [KeysService],
})
export class KeysModule {}
