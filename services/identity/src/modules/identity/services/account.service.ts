import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode } from '@netverse/nest-kit';
import { UpdateProfileDto } from '../dto/identity-request.dto';
import { ProfileDto, SessionListDto } from '../dto/identity-response.dto';
import { PrincipalRepository } from '../repositories/principal.repository';
import { SessionRepository } from '../repositories/session.repository';
import { CredentialService } from './credential.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly credentials: CredentialService,
    private readonly principals: PrincipalRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async profile(principalId: string): Promise<ProfileDto> {
    const [principal, memberships] = await Promise.all([
      this.credentials.requirePrincipal(principalId),
      this.principals.listMemberships(principalId),
    ]);
    return {
      id: principal.id,
      email: principal.email,
      emailVerified: principal.emailVerifiedAt !== null,
      displayName: principal.displayName,
      avatarUrl: principal.avatarUrl,
      hasPassword: principal.passwordHash !== null,
      memberships: memberships.map((membership) => ({
        tenantId: membership.tenant.id,
        slug: membership.tenant.slug,
        name: membership.tenant.name,
        roles: membership.roles.map(({ role }) => role.name),
      })),
    };
  }

  async updateProfile(principalId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    await this.principals.update(principalId, {
      displayName: dto.displayName,
      avatarUrl: dto.avatarUrl,
    });
    return this.profile(principalId);
  }

  async listSessions(actor: Actor): Promise<SessionListDto> {
    const rows = await this.sessions.listActive(actor.subject);
    return {
      sessions: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        current: row.id === actor.sessionId,
      })),
    };
  }

  async revokeSession(principalId: string, sessionId: string): Promise<void> {
    if (!(await this.sessions.revoke(sessionId, principalId))) {
      throw new AppException(ErrorCode.NOT_FOUND);
    }
  }
}
