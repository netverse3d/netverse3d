import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, errors as joseErrors, JWTPayload, jwtVerify } from 'jose';
import { AppConfig } from '../../../config/app-config';
import {
  SocialCredential,
  SocialCredentialRejected,
  SocialProfile,
  SocialProviderAdapter,
  SocialProviderName,
} from './social-provider';

function asVerified(claim: unknown): boolean {
  return claim === true || claim === 'true';
}

abstract class IdTokenProvider implements SocialProviderAdapter {
  abstract readonly name: SocialProviderName;
  protected abstract readonly clientIds: string[];
  protected abstract readonly issuers: string[];
  protected abstract readonly keySet: ReturnType<typeof createRemoteJWKSet>;

  isEnabled(): boolean {
    return this.clientIds.length > 0;
  }

  async verify({ credential }: SocialCredential): Promise<SocialProfile> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(credential, this.keySet, {
        issuer: this.issuers,
        audience: this.clientIds,
        requiredClaims: ['sub', 'exp'],
      }));
    } catch (error) {
      if (error instanceof joseErrors.JOSEError && !(error instanceof joseErrors.JWKSTimeout)) {
        throw new SocialCredentialRejected(error.code);
      }
      throw error;
    }
    return {
      subject: payload.sub as string,
      email: typeof payload.email === 'string' ? payload.email : null,
      emailVerified: asVerified(payload.email_verified),
      displayName: typeof payload.name === 'string' ? payload.name : null,
      avatarUrl: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }
}

@Injectable()
export class GoogleProvider extends IdTokenProvider {
  readonly name = 'GOOGLE' as const;
  protected readonly clientIds: string[];
  protected readonly issuers: string[];
  protected readonly keySet: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: AppConfig) {
    super();
    this.clientIds = config.social.google.clientIds;
    this.issuers = config.social.google.issuers;
    this.keySet = createRemoteJWKSet(new URL(config.social.google.jwksUrl));
  }
}

@Injectable()
export class AppleProvider extends IdTokenProvider {
  readonly name = 'APPLE' as const;
  protected readonly clientIds: string[];
  protected readonly issuers: string[];
  protected readonly keySet: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: AppConfig) {
    super();
    this.clientIds = config.social.apple.clientIds;
    this.issuers = [config.social.apple.issuer];
    this.keySet = createRemoteJWKSet(new URL(config.social.apple.jwksUrl));
  }
}
