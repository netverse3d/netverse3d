import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import type { Actor } from '../../common/context/request-context';
import { KitConfig } from '../../config/kit-config';
import { tenantOfClaim } from './platform-roles';

const ACCEPTED_ALGORITHMS = ['RS256', 'ES256'];

function stringsOf(claim: unknown): string[] {
  return Array.isArray(claim) ? claim.filter((item) => typeof item === 'string') : [];
}

@Injectable()
export class JwtVerifier {
  private readonly keySet: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: KitConfig) {
    this.keySet = createRemoteJWKSet(
      new URL(config.auth.jwksUrl),
      config.auth.jwksCooldownMs === undefined
        ? undefined
        : { cooldownDuration: config.auth.jwksCooldownMs },
    );
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
    const subject = payload.sub as string;
    if (typeof payload.client_id === 'string') {
      return {
        subject,
        tenantId: null,
        roles: [],
        service: { clientId: payload.client_id, permissions: stringsOf(payload.permissions) },
      };
    }
    const tenantId = tenantOfClaim(payload[this.config.auth.tenantClaim]);
    return {
      subject,
      tenantId,
      roles: stringsOf(payload[this.config.auth.rolesClaim]),
      ...(typeof payload.sid === 'string' ? { sessionId: payload.sid } : {}),
      ...(typeof payload.ver === 'number' ? { tokenVersion: payload.ver } : {}),
    };
  }
}
