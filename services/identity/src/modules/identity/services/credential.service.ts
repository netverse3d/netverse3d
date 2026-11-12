import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppException } from '@netverse/nest-kit';
import { AppConfig } from '../../../config/app-config';
import { AuditService } from '@netverse/nest-kit';
import { OutboxRepository } from '@netverse/nest-kit';
import { TokenPairDto } from '../dto/identity-response.dto';
import { IdentityErrorCode } from '../identity-error-codes';
import {
  DbTransaction,
  PrincipalRepository,
  PrincipalRow,
} from '../repositories/principal.repository';
import { SessionRepository } from '../repositories/session.repository';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class CredentialService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CredentialService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly principals: PrincipalRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxRepository,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { adminEmail, adminPassword } = this.config.bootstrap;
    if (!adminEmail || !adminPassword || (await this.principals.countPlatformAdmins()) > 0) {
      return;
    }
    const passwordHash = await this.passwords.hash(adminPassword);
    await this.principals.transaction((transaction) =>
      this.principals.create(
        {
          email: normalizeEmail(adminEmail),
          emailVerifiedAt: new Date(),
          passwordHash,
          isPlatformAdmin: true,
        },
        transaction,
      ),
    );
    this.logger.log('created the first platform administrator');
  }

  async register(
    rawEmail: string,
    password: string,
    displayName: string | undefined,
  ): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const passwordHash = await this.passwords.hash(password);
    const existing = await this.principals.findByEmail(email);
    if (existing) {
      if (!existing.emailVerifiedAt) {
        await this.otp.issue(existing.id, email, 'EMAIL_VERIFICATION');
      }
      return;
    }

    let principal: PrincipalRow;
    try {
      principal = await this.principals.transaction(async (transaction) => {
        const created = await this.principals.create(
          { email, passwordHash, displayName },
          transaction,
        );
        await this.emitUserEvent('user.registered', created, transaction);
        return created;
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        return;
      }
      throw error;
    }
    await this.otp.issue(principal.id, email, 'EMAIL_VERIFICATION');
  }

  async resendVerification(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const principal = await this.principals.findByEmail(email);
    if (principal && !principal.emailVerifiedAt) {
      await this.otp.issue(principal.id, email, 'EMAIL_VERIFICATION');
    }
  }

  async verifyEmail(rawEmail: string, code: string): Promise<void> {
    const principal = await this.principals.findByEmail(normalizeEmail(rawEmail));
    const otp = principal && (await this.otp.matchLatest(principal.id, 'EMAIL_VERIFICATION', code));
    if (!principal || !otp) {
      throw new AppException(IdentityErrorCode.INVALID_OTP);
    }
    await this.principals.transaction(async (transaction) => {
      if (!(await this.otp.consume(otp, transaction))) {
        throw new AppException(IdentityErrorCode.INVALID_OTP);
      }
      const verified = await this.principals.update(
        principal.id,
        { emailVerifiedAt: new Date() },
        transaction,
      );
      await this.emitUserEvent('user.email-verified', verified, transaction);
    });
  }

  async login(rawEmail: string, password: string, tenantId: string | null): Promise<TokenPairDto> {
    const email = normalizeEmail(rawEmail);
    const principal = await this.principals.findByEmail(email);
    if (!principal?.passwordHash) {
      await this.passwords.burnComparisonTime(password);
      await this.recordLogin('FAILURE', null, tenantId, IdentityErrorCode.INVALID_CREDENTIALS.code);
      throw new AppException(IdentityErrorCode.INVALID_CREDENTIALS);
    }

    const locked = principal.lockedUntil !== null && principal.lockedUntil > new Date();
    if (locked || !(await this.passwords.matches(password, principal.passwordHash))) {
      if (locked) {
        await this.passwords.burnComparisonTime(password);
      } else {
        await this.registerFailure(principal);
      }
      await this.recordLogin(
        'FAILURE',
        principal.id,
        tenantId,
        IdentityErrorCode.INVALID_CREDENTIALS.code,
      );
      throw new AppException(IdentityErrorCode.INVALID_CREDENTIALS);
    }
    if (!principal.emailVerifiedAt) {
      await this.recordLogin(
        'FAILURE',
        principal.id,
        tenantId,
        IdentityErrorCode.EMAIL_NOT_VERIFIED.code,
      );
      throw new AppException(IdentityErrorCode.EMAIL_NOT_VERIFIED);
    }
    if (principal.failedLogins > 0) {
      await this.principals.resetFailedLogins(principal.id);
    }

    const pair = await this.tokens.startSession(principal, tenantId);
    await this.recordLogin('SUCCESS', principal.id, tenantId);
    return pair;
  }

  async forgotPassword(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const principal = await this.principals.findByEmail(email);
    if (principal?.status === 'ACTIVE') {
      await this.otp.issue(principal.id, email, 'PASSWORD_RESET');
    }
  }

  async resetPassword(rawEmail: string, code: string, newPassword: string): Promise<void> {
    const principal = await this.principals.findByEmail(normalizeEmail(rawEmail));
    const otp = principal && (await this.otp.matchLatest(principal.id, 'PASSWORD_RESET', code));
    if (!principal || !otp) {
      throw new AppException(IdentityErrorCode.INVALID_OTP);
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.principals.transaction(async (transaction) => {
      if (!(await this.otp.consume(otp, transaction))) {
        throw new AppException(IdentityErrorCode.INVALID_OTP);
      }
      await this.applyNewPassword(principal.id, passwordHash, transaction);
      await this.principals.update(
        principal.id,
        { emailVerifiedAt: principal.emailVerifiedAt ?? new Date() },
        transaction,
      );
    });
  }

  async changePassword(
    principalId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const principal = await this.requirePrincipal(principalId);
    if (!principal.passwordHash) {
      throw new AppException(IdentityErrorCode.PASSWORD_NOT_SET);
    }
    if (!(await this.passwords.matches(currentPassword, principal.passwordHash))) {
      throw new AppException(IdentityErrorCode.INVALID_CREDENTIALS);
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.principals.transaction((transaction) =>
      this.applyNewPassword(principalId, passwordHash, transaction),
    );
  }

  async logoutEverywhere(principalId: string): Promise<void> {
    await this.principals.transaction(async (transaction) => {
      await this.principals.update(principalId, { tokenVersion: { increment: 1 } }, transaction);
      await this.sessions.revokeAll(principalId, transaction);
    });
  }

  async requirePrincipal(id: string): Promise<PrincipalRow> {
    const principal = await this.principals.findById(id);
    if (!principal) {
      throw new AppException(IdentityErrorCode.PRINCIPAL_NOT_FOUND);
    }
    return principal;
  }

  emitUserEvent(type: string, principal: PrincipalRow, transaction: DbTransaction): Promise<void> {
    return this.outbox.enqueue(
      {
        type,
        aggregateId: principal.id,
        tenantId: null,
        payload: { principalId: principal.id, email: principal.email, status: principal.status },
      },
      transaction,
    );
  }

  private async applyNewPassword(
    principalId: string,
    passwordHash: string,
    transaction: DbTransaction,
  ): Promise<void> {
    await this.principals.update(
      principalId,
      { passwordHash, tokenVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
      transaction,
    );
    await this.sessions.revokeAll(principalId, transaction);
  }

  private async registerFailure(principal: PrincipalRow): Promise<void> {
    const failures = principal.failedLogins + 1;
    const { maxFailures, lockMinutes } = this.config.password;
    const locks = failures >= maxFailures;
    await this.principals.registerFailedLogin(
      principal.id,
      locks ? 0 : failures,
      locks ? new Date(Date.now() + lockMinutes * 60_000) : null,
    );
  }

  private recordLogin(
    outcome: 'SUCCESS' | 'FAILURE',
    principalId: string | null,
    tenantId: string | null,
    errorCode?: string,
  ): Promise<void> {
    return this.audit.recordWithoutFailing({
      action: 'auth.login',
      resourceType: 'principal',
      resourceId: principalId ?? undefined,
      outcome,
      errorCode,
      actorSubject: principalId ?? undefined,
      tenantId,
    });
  }
}
