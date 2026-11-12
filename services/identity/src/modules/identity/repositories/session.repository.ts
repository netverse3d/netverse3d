import { Injectable } from '@nestjs/common';
import { Principal, RefreshToken, Session } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DbTransaction } from './principal.repository';

export type SessionRow = Session;
export type RefreshWithSession = RefreshToken & { session: Session & { principal: Principal } };

export interface NewSession {
  principalId: string;
  tenantId: string | null;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(data: NewSession, transaction: DbTransaction): Promise<SessionRow> {
    return transaction.session.create({ data });
  }

  async createRefreshToken(
    sessionId: string,
    tokenHash: string,
    expiresAt: Date,
    transaction: DbTransaction,
  ): Promise<void> {
    await transaction.refreshToken.create({ data: { sessionId, tokenHash, expiresAt } });
  }

  findRefresh(tokenHash: string): Promise<RefreshWithSession | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: { include: { principal: true } } },
    });
  }

  async markRefreshUsed(id: string, now: Date, transaction: DbTransaction): Promise<boolean> {
    const { count } = await transaction.refreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  }

  async touch(sessionId: string, now: Date, transaction: DbTransaction): Promise<void> {
    await transaction.session.update({ where: { id: sessionId }, data: { lastUsedAt: now } });
  }

  findById(id: string): Promise<SessionRow | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  findActiveWithPrincipal(id: string): Promise<(SessionRow & { principal: Principal }) | null> {
    return this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { principal: true },
    });
  }

  listActive(principalId: string): Promise<SessionRow[]> {
    return this.prisma.session.findMany({
      where: { principalId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async revoke(id: string, principalId: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id, principalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(principalId: string, transaction?: DbTransaction): Promise<void> {
    await (transaction ?? this.prisma).session.updateMany({
      where: { principalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(before: Date): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }
}
