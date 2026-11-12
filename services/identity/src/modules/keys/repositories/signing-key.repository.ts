import { Injectable } from '@nestjs/common';
import { Prisma, SigningKey } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type SigningKeyRow = SigningKey;

export interface NewSigningKey {
  kid: string;
  status: SigningKey['status'];
  publicJwk: object;
  privateKeyEnc: string;
}

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class SigningKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(): Promise<SigningKeyRow | null> {
    return this.prisma.signingKey.findFirst({ where: { status: 'ACTIVE' } });
  }

  findPublished(): Promise<SigningKeyRow[]> {
    return this.prisma.signingKey.findMany({ where: { status: { in: ['ACTIVE', 'RETIRING'] } } });
  }

  findAll(): Promise<SigningKeyRow[]> {
    return this.prisma.signingKey.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async insertIfNoActive(key: NewSigningKey): Promise<boolean> {
    try {
      await this.prisma.signingKey.create({
        data: { ...key, publicJwk: key.publicJwk as Prisma.InputJsonObject },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
        return false;
      }
      throw error;
    }
  }

  async replaceActive(key: NewSigningKey): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.signingKey.findFirst({ where: { status: 'ACTIVE' } });
      if (current) {
        await tx.signingKey.update({
          where: { kid: current.kid },
          data: { status: 'RETIRING', retiredAt: new Date() },
        });
      }
      await tx.signingKey.create({
        data: { ...key, publicJwk: key.publicJwk as Prisma.InputJsonObject },
      });
      return current?.kid ?? null;
    });
  }

  async revokeRetiredBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.signingKey.updateMany({
      where: { status: 'RETIRING', retiredAt: { lt: cutoff } },
      data: { status: 'REVOKED' },
    });
    return count;
  }
}
