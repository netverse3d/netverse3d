import { Injectable } from '@nestjs/common';
import { OtpCode } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DbTransaction } from './principal.repository';

export type OtpRow = OtpCode;
export type OtpPurposeValue = OtpCode['purpose'];

@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatest(principalId: string, purpose: OtpPurposeValue): Promise<OtpRow | null> {
    return this.prisma.otpCode.findFirst({
      where: { principalId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  }

  async replace(
    principalId: string,
    purpose: OtpPurposeValue,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.otpCode.updateMany({
        where: { principalId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({ data: { principalId, purpose, codeHash, expiresAt } }),
    ]);
  }

  async countAttempt(id: string): Promise<number> {
    const { attempts } = await this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    return attempts;
  }

  async consume(id: string, now: Date, transaction: DbTransaction): Promise<boolean> {
    const { count } = await transaction.otpCode.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: now },
    });
    return count === 1;
  }

  async deleteExpired(before: Date): Promise<number> {
    const { count } = await this.prisma.otpCode.deleteMany({
      where: { expiresAt: { lt: before } },
    });
    return count;
  }
}
