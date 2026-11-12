import { Injectable } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { AuditService } from '@netverse/nest-kit';
import { TokenPairDto } from '../dto/identity-response.dto';
import { IdentityErrorCode } from '../identity-error-codes';
import {
  ExternalIdentityRow,
  PrincipalRepository,
  PrincipalRow,
} from '../repositories/principal.repository';
import { SocialCredential, SocialProfile, SocialProviderName } from '../social/social-provider';
import { SocialProviderRegistry } from '../social/social-provider.registry';
import { CredentialService, normalizeEmail } from './credential.service';
import { TokenService } from './token.service';

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class SocialLoginService {
  constructor(
    private readonly registry: SocialProviderRegistry,
    private readonly principals: PrincipalRepository,
    private readonly credentials: CredentialService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  enabledProviders(): SocialProviderName[] {
    return this.registry.enabledProviders();
  }

  async login(
    provider: SocialProviderName,
    input: SocialCredential,
    tenantId: string | null,
  ): Promise<TokenPairDto> {
    const profile = await this.registry.verify(provider, input);
    const principal = await this.resolvePrincipal(provider, profile);
    const pair = await this.tokens.startSession(principal, tenantId);
    await this.audit.recordWithoutFailing({
      action: 'auth.social_login',
      resourceType: 'principal',
      resourceId: principal.id,
      outcome: 'SUCCESS',
      actorSubject: principal.id,
      tenantId,
      metadata: { provider },
    });
    return pair;
  }

  async link(
    principalId: string,
    provider: SocialProviderName,
    input: SocialCredential,
  ): Promise<void> {
    const profile = await this.registry.verify(provider, input);
    try {
      await this.principals.createExternal({
        principalId,
        provider,
        providerSubject: profile.subject,
        email: this.trustedEmail(profile),
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
        throw new AppException(IdentityErrorCode.IDENTITY_ALREADY_LINKED);
      }
      throw error;
    }
  }

  listLinked(principalId: string): Promise<ExternalIdentityRow[]> {
    return this.principals.listExternal(principalId);
  }

  async unlink(principalId: string, provider: SocialProviderName): Promise<void> {
    const [principal, linked] = await Promise.all([
      this.credentials.requirePrincipal(principalId),
      this.principals.listExternal(principalId),
    ]);
    if (!linked.some((identity) => identity.provider === provider)) {
      throw new AppException(IdentityErrorCode.PROVIDER_DISABLED);
    }
    if (!principal.passwordHash && linked.length === 1) {
      throw new AppException(IdentityErrorCode.LAST_SIGN_IN_METHOD);
    }
    await this.principals.deleteExternal(principalId, provider);
  }

  private trustedEmail(profile: SocialProfile): string | null {
    return profile.email && profile.emailVerified ? normalizeEmail(profile.email) : null;
  }

  private async resolvePrincipal(
    provider: SocialProviderName,
    profile: SocialProfile,
  ): Promise<PrincipalRow> {
    const linked = await this.principals.findExternal(provider, profile.subject);
    if (linked) {
      return linked.principal;
    }

    const email = this.trustedEmail(profile);
    const sameEmail = email ? await this.principals.findByEmail(email) : null;
    if (sameEmail && !sameEmail.emailVerifiedAt) {
      throw new AppException(IdentityErrorCode.EMAIL_LINK_REQUIRED);
    }

    try {
      return await this.principals.transaction(async (transaction) => {
        const principal =
          sameEmail ??
          (await this.principals.create(
            {
              email,
              emailVerifiedAt: email ? new Date() : null,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
            },
            transaction,
          ));
        await this.principals.createExternal(
          { principalId: principal.id, provider, providerSubject: profile.subject, email },
          transaction,
        );
        if (!sameEmail) {
          await this.credentials.emitUserEvent('user.registered', principal, transaction);
        }
        return principal;
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
        const raced = await this.principals.findExternal(provider, profile.subject);
        if (raced) {
          return raced.principal;
        }
      }
      throw error;
    }
  }
}
