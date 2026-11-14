import { Module } from '@nestjs/common';
import { ProviderCredentialCryptoService } from '@app/infrastructure/secrets/provider-credential-crypto.service';
import { ProvidersModule } from '@app/modules/providers/providers.module';
import { ProviderAccountAdminController } from './controllers/provider-account-admin.controller';
import { ProviderAccountRepository } from './repositories/provider-account.repository';
import { ProviderAccountResolver } from './services/provider-account-resolver.service';
import { ProviderAccountService } from './services/provider-account.service';

@Module({
  imports: [ProvidersModule],
  controllers: [ProviderAccountAdminController],
  providers: [
    ProviderAccountRepository,
    ProviderCredentialCryptoService,
    ProviderAccountResolver,
    ProviderAccountService,
  ],
  exports: [ProviderAccountResolver, ProviderAccountService],
})
export class ProviderAccountsModule {}
