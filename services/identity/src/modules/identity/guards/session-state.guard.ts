import { CanActivate, Injectable } from '@nestjs/common';
import { currentActor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { IdentityErrorCode } from '../identity-error-codes';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class SessionStateGuard implements CanActivate {
  constructor(private readonly sessions: SessionRepository) {}

  async canActivate(): Promise<boolean> {
    const actor = currentActor();
    if (!actor?.sessionId) {
      return true;
    }
    const session = await this.sessions.findActiveWithPrincipal(actor.sessionId);
    if (
      !session ||
      session.principal.status !== 'ACTIVE' ||
      session.principal.tokenVersion !== actor.tokenVersion
    ) {
      throw new AppException(IdentityErrorCode.SESSION_REVOKED);
    }
    return true;
  }
}
