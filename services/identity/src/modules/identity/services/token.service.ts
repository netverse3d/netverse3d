import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { currentRequestContext } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import { KeysService } from '../../keys/services/keys.service';
import { PLATFORM_ADMIN_ROLE, isPlatformOnlyRole } from '../../tenancy/domain/platform-roles';
import { TokenPairDto } from '../dto/identity-response.dto';
import { IdentityErrorCode } from '../identity-error-codes';
import {
  DbTransaction,
  PrincipalRepository,
  PrincipalRow,
} from '../repositories/principal.repository';
import { SessionRepository } from '../repositories/session.repository';

const DAY_MS = 86_400_000;

export interface TenantAccess {
  tenantId: string | null;
  roles: string[];
  permissions: string[];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokenService {
  constructor(
    private readonly config: AppConfig,
    private readonly keys: KeysService,
    private readonly principals: PrincipalRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async startSession(principal: PrincipalRow, tenantId: string | null): Promise<TokenPairDto> {
    this.assertActive(principal);
    const access = await this.resolveAccess(principal, tenantId);
    const context = currentRequestContext();
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.tokens.refreshTtlDays * DAY_MS);

    const session = await this.principals.transaction(async (transaction) => {
      const created = await this.sessions.createSession(
        {
          principalId: principal.id,
          tenantId: access.tenantId,
          ip: context?.ip ?? null,
          userAgent: context?.userAgent ?? null,
          expiresAt,
        },
        transaction,
      );
      await this.sessions.createRefreshToken(
        created.id,
        hashToken(refreshToken),
        expiresAt,
        transaction,
      );
      return created;
    });
    return this.toTokenPair(principal, access, session.id, refreshToken);
  }

  async refresh(presented: string): Promise<TokenPairDto> {
    const stored = await this.sessions.findRefresh(hashToken(presented));
    if (!stored) {
      throw new AppException(IdentityErrorCode.REFRESH_INVALID);
    }
    const { session } = stored;
    if (session.revokedAt || stored.expiresAt <= new Date() || session.expiresAt <= new Date()) {
      throw new AppException(IdentityErrorCode.REFRESH_INVALID);
    }
    if (stored.usedAt) {
      await this.handleReplay(stored.usedAt, session.id);
    }

    this.assertActive(session.principal);
    const access = await this.resolveAccess(session.principal, session.tenantId);
    const nextToken = randomBytes(32).toString('base64url');

    await this.principals.transaction(async (transaction: DbTransaction) => {
      const now = new Date();
      if (!(await this.sessions.markRefreshUsed(stored.id, now, transaction))) {
        throw new AppException(IdentityErrorCode.REFRESH_INVALID);
      }
      await this.sessions.createRefreshToken(
        session.id,
        hashToken(nextToken),
        session.expiresAt,
        transaction,
      );
      await this.sessions.touch(session.id, now, transaction);
    });
    return this.toTokenPair(session.principal, access, session.id, nextToken);
  }

  async revokeByRefreshToken(presented: string): Promise<void> {
    const stored = await this.sessions.findRefresh(hashToken(presented));
    if (stored) {
      await this.sessions.revokeById(stored.sessionId);
    }
  }

  async resolveAccess(principal: PrincipalRow, tenantId: string | null): Promise<TenantAccess> {
    if (!tenantId) {
      return {
        tenantId: null,
        roles: principal.isPlatformAdmin ? [PLATFORM_ADMIN_ROLE] : [],
        permissions: [],
      };
    }
    const membership = await this.principals.findMembership(principal.id, tenantId);
    if (!membership || membership.status !== 'ACTIVE' || membership.tenant.status !== 'ACTIVE') {
      throw new AppException(IdentityErrorCode.NOT_A_MEMBER);
    }
    const granted = membership.roles.filter(({ role }) => !isPlatformOnlyRole(role.name));
    const roles = granted.map(({ role }) => role.name);
    const permissions = [...new Set(granted.flatMap(({ role }) => role.permissions))];
    return { tenantId, roles, permissions };
  }

  private async handleReplay(usedAt: Date, sessionId: string): Promise<never> {
    const graceMs = this.config.tokens.refreshReuseGraceSeconds * 1000;
    if (Date.now() - usedAt.getTime() <= graceMs) {
      throw new AppException(IdentityErrorCode.REFRESH_INVALID);
    }
    await this.sessions.revokeById(sessionId);
    throw new AppException(IdentityErrorCode.REFRESH_REUSED);
  }

  private assertActive(principal: PrincipalRow): void {
    if (principal.status !== 'ACTIVE') {
      throw new AppException(IdentityErrorCode.ACCOUNT_SUSPENDED);
    }
  }

  private async toTokenPair(
    principal: PrincipalRow,
    access: TenantAccess,
    sessionId: string,
    refreshToken: string,
  ): Promise<TokenPairDto> {
    const accessToken = await this.keys.sign(
      {
        roles: access.roles,
        permissions: access.permissions,
        sid: sessionId,
        ver: principal.tokenVersion,
        ...(access.tenantId ? { [this.config.auth.tenantClaim]: access.tenantId } : {}),
      },
      principal.id,
    );
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.tokens.accessTtlSeconds,
      tenantId: access.tenantId,
    };
  }
}
