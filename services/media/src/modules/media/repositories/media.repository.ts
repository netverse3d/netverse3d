import { Injectable } from '@nestjs/common';
import { MediaIdempotency, MediaObject, Prisma } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { MediaListScope } from '../domain/media-access';

export type MediaRow = MediaObject;
export type MediaTransaction = Prisma.TransactionClient;
export type NewMedia = Prisma.MediaObjectUncheckedCreateInput;
export type MediaChanges = Prisma.MediaObjectUncheckedUpdateManyInput;
export type MediaOrderBy = Prisma.MediaObjectOrderByWithRelationInput;
export type IdempotentMedia = MediaIdempotency & { media: MediaObject };

export interface MediaListFilter extends MediaListScope {
  ownerType?: string;
  ownerId?: string;
  mediaClass?: MediaObject['mediaClass'];
}

const UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (transaction: MediaTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  findById(id: string): Promise<MediaRow | null> {
    return this.prisma.mediaObject.findUnique({ where: { id } });
  }

  findIdempotent(scope: string, key: string): Promise<IdempotentMedia | null> {
    return this.prisma.mediaIdempotency.findUnique({
      where: { scope_key: { scope, key } },
      include: { media: true },
    });
  }

  create(data: NewMedia, transaction: MediaTransaction): Promise<MediaRow> {
    return transaction.mediaObject.create({ data });
  }

  async rememberIdempotency(
    scope: string,
    key: string,
    mediaId: string,
    requestHash: Uint8Array<ArrayBuffer>,
    transaction: MediaTransaction,
  ): Promise<void> {
    await transaction.mediaIdempotency.create({ data: { scope, key, mediaId, requestHash } });
  }

  async updateIfStatus(
    id: string,
    expected: MediaRow['status'],
    data: MediaChanges,
    transaction: MediaTransaction,
  ): Promise<MediaRow | null> {
    const { count } = await transaction.mediaObject.updateMany({
      where: { id, status: expected },
      data,
    });
    return count === 1 ? transaction.mediaObject.findUnique({ where: { id } }) : null;
  }

  update(id: string, data: MediaChanges, transaction: MediaTransaction): Promise<MediaRow> {
    return transaction.mediaObject.update({ where: { id }, data });
  }

  findPage(
    filter: MediaListFilter,
    orderBy: MediaOrderBy,
    skip: number,
    take: number,
  ): Promise<[MediaRow[], number]> {
    const where: Prisma.MediaObjectWhereInput = {
      ...(filter.tenantId === undefined ? {} : { tenantId: filter.tenantId }),
      lifecycle: 'PERMANENT',
      status: { not: 'DELETED' },
      ...(filter.ownerType ? { ownerType: filter.ownerType } : {}),
      ...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
      ...(filter.mediaClass ? { mediaClass: filter.mediaClass } : {}),
      ...(filter.viewerSubject
        ? {
            OR: [
              { visibility: { in: filter.sharedVisibilities } },
              { createdBy: filter.viewerSubject },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.mediaObject.findMany({ where, orderBy, skip, take }),
      this.prisma.mediaObject.count({ where }),
    ]);
  }

  findStalePending(createdBefore: Date, take: number): Promise<MediaRow[]> {
    return this.prisma.mediaObject.findMany({
      where: { status: 'PENDING', createdAt: { lt: createdBefore } },
      take,
    });
  }

  async purge(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mediaIdempotency.deleteMany({ where: { mediaId: id } }),
      this.prisma.mediaObject.delete({ where: { id } }),
    ]);
  }

  findExpiredTemporary(now: Date, take: number): Promise<MediaRow[]> {
    return this.prisma.mediaObject.findMany({
      where: { lifecycle: 'TEMPORARY', status: { not: 'DELETED' }, expiresAt: { lt: now } },
      take,
    });
  }

  findReadyForHardDelete(deletedBefore: Date, now: Date, take: number): Promise<MediaRow[]> {
    return this.prisma.mediaObject.findMany({
      where: {
        status: 'DELETED',
        hardDeletedAt: null,
        deletedAt: { lte: deletedBefore },
        OR: [{ retentionUntil: null }, { retentionUntil: { lte: now } }],
      },
      take,
    });
  }

  async markHardDeleted(id: string, now: Date): Promise<void> {
    await this.prisma.mediaObject.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: now, hardDeletedAt: now },
    });
  }
}
