import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { KeysModule } from '../keys/keys.module';
import { OutboxModule } from '@netverse/nest-kit';
import { createOtpSender } from './adapters/otp-senders';
import { AuthController } from './controllers/auth.controller';
import { MeController } from './controllers/me.controller';
import { SessionStateGuard } from './guards/session-state.guard';
import { IdentityCleanupJob } from './jobs/identity-cleanup.job';
import { OtpSender } from './ports/otp-sender';
import { OtpRepository } from './repositories/otp.repository';
import { PrincipalRepository } from './repositories/principal.repository';
import { SessionRepository } from './repositories/session.repository';
import { CredentialService } from './services/credential.service';
import { AccountService } from './services/account.service';
import { OtpService } from './services/otp.service';
import { PasswordService } from './services/password.service';
import { SocialLoginService } from './services/social-login.service';
import { TokenService } from './services/token.service';
import { FacebookProvider, GithubProvider, ZaloProvider } from './social/access-token.providers';
import { AppleProvider, GoogleProvider } from './social/oidc-id-token.providers';
import { SocialProviderRegistry } from './social/social-provider.registry';

@Global()
@Module({
  imports: [KeysModule, OutboxModule],
  controllers: [AuthController, MeController],
  providers: [
    PrincipalRepository,
    SessionRepository,
    OtpRepository,
    AccountService,
    PasswordService,
    OtpService,
    TokenService,
    CredentialService,
    SocialLoginService,
    SocialProviderRegistry,
    GoogleProvider,
    AppleProvider,
    FacebookProvider,
    ZaloProvider,
    GithubProvider,
    SessionStateGuard,
    IdentityCleanupJob,
    { provide: OtpSender, useFactory: createOtpSender, inject: [AppConfig] },
  ],
  exports: [
    SessionStateGuard,
    PrincipalRepository,
    CredentialService,
    TokenService,
    SessionRepository,
  ],
})
export class IdentityModule {}
