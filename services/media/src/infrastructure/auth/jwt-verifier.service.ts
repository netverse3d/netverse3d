import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import type { Actor } from '../../common/context/request-context';
import { AppConfig } from '../../config/app-config';

const ACCEPTED_ALGORITHMS = ['RS256', 'ES256'];

@Injectable()
export class JwtVerifier {
  private readonly keySet: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: AppConfig) {
    this.keySet = createRemoteJWKSet(new URL(config.auth.jwksUrl));
  }

  async verify(token: string): Promise<Actor> {
    const { payload } = await jwtVerify(token, this.keySet, {
      issuer: this.config.auth.issuer,
      audience: this.config.auth.audience,
      algorithms: ACCEPTED_ALGORITHMS,
      requiredClaims: ['sub', 'exp'],
    });
    return this.toActor(payload);
  }

  private toActor(payload: JWTPayload): Actor {
    const tenant = payload[this.config.auth.tenantClaim];
    const roles = payload[this.config.auth.rolesClaim];
    return {
      subject: payload.sub as string,
      tenantId: typeof tenant === 'string' ? tenant : null,
      roles: Array.isArray(roles) ? roles.filter((role) => typeof role === 'string') : [],
    };
  }
}
