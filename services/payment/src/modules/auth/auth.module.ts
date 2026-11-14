import { Global, Module } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyAuthRepository } from './repositories/api-key-auth.repository';
import { ApiKeyAuthService } from './services/api-key-auth.service';

@Global()
@Module({
  providers: [ApiKeyAuthRepository, ApiKeyAuthService, ApiKeyGuard],
  exports: [ApiKeyAuthService, ApiKeyGuard],
})
export class ApiKeyAuthModule {}
