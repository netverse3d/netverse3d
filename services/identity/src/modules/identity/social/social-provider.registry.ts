import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { IdentityErrorCode } from '../identity-error-codes';
import { FacebookProvider, GithubProvider, ZaloProvider } from './access-token.providers';
import { AppleProvider, GoogleProvider } from './oidc-id-token.providers';
import {
  SocialCredential,
  SocialCredentialRejected,
  SocialProfile,
  SocialProviderAdapter,
  SocialProviderName,
} from './social-provider';

@Injectable()
export class SocialProviderRegistry {
  private readonly logger = new Logger(SocialProviderRegistry.name);
  private readonly adapters: SocialProviderAdapter[];

  constructor(
    google: GoogleProvider,
    apple: AppleProvider,
    facebook: FacebookProvider,
    zalo: ZaloProvider,
    github: GithubProvider,
  ) {
    this.adapters = [google, apple, facebook, zalo, github];
  }

  enabledProviders(): SocialProviderName[] {
    return this.adapters.filter((adapter) => adapter.isEnabled()).map((adapter) => adapter.name);
  }

  async verify(name: SocialProviderName, input: SocialCredential): Promise<SocialProfile> {
    const adapter = this.adapters.find((candidate) => candidate.name === name);
    if (!adapter?.isEnabled()) {
      throw new AppException(IdentityErrorCode.PROVIDER_DISABLED);
    }
    try {
      return await adapter.verify(input);
    } catch (error) {
      if (error instanceof SocialCredentialRejected) {
        throw new AppException(IdentityErrorCode.SOCIAL_CREDENTIAL_INVALID);
      }
      this.logger.error(error instanceof Error ? error : String(error));
      throw new AppException(IdentityErrorCode.PROVIDER_UNAVAILABLE);
    }
  }
}
