import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import { LockedJob } from '../../../infrastructure/jobs/locked-job';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { MediaRepository, MediaRow } from '../repositories/media.repository';

const BATCH_SIZE = 100;
const PENDING_LOCK_ID = 7101;
const TEMPORARY_LOCK_ID = 7102;
const HARD_DELETE_LOCK_ID = 7103;

abstract class MediaReaper extends LockedJob {
  protected constructor(
    prisma: PrismaService,
    lockId: number,
    config: AppConfig,
    protected readonly storage: StorageService,
  ) {
    super(prisma, lockId, config.jobs.reaperIntervalSeconds * 1000, config.jobs.enabled);
  }

  protected async removedFromStorage(row: MediaRow): Promise<boolean> {
    try {
      await this.storage.remove(row.bucket, row.objectKey);
      return true;
    } catch (error) {
      this.logger.warn(
        `could not remove ${row.bucket}/${row.objectKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  protected async forEachRemoved(
    rows: MediaRow[],
    onRemoved: (row: MediaRow) => Promise<void>,
  ): Promise<number> {
    let processed = 0;
    for (const row of rows) {
      if (await this.removedFromStorage(row)) {
        await onRemoved(row);
        processed += 1;
      }
    }
    if (processed > 0) {
      this.logger.log(`processed ${processed} media objects`);
    }
    return processed;
  }
}

@Injectable()
export class PendingReaper extends MediaReaper {
  constructor(
    prisma: PrismaService,
    private readonly config: AppConfig,
    storage: StorageService,
    private readonly repository: MediaRepository,
  ) {
    super(prisma, PENDING_LOCK_ID, config, storage);
  }

  protected async work(): Promise<number> {
    const cutoff = new Date(Date.now() - this.config.jobs.pendingExpirySeconds * 1000);
    const rows = await this.repository.findStalePending(cutoff, BATCH_SIZE);
    return this.forEachRemoved(rows, (row) => this.repository.purge(row.id));
  }
}

@Injectable()
export class TemporaryReaper extends MediaReaper {
  constructor(
    prisma: PrismaService,
    config: AppConfig,
    storage: StorageService,
    private readonly repository: MediaRepository,
  ) {
    super(prisma, TEMPORARY_LOCK_ID, config, storage);
  }

  protected async work(): Promise<number> {
    const now = new Date();
    const rows = await this.repository.findExpiredTemporary(now, BATCH_SIZE);
    return this.forEachRemoved(rows, (row) => this.repository.markHardDeleted(row.id, now));
  }
}

@Injectable()
export class HardDeleteReaper extends MediaReaper {
  constructor(
    prisma: PrismaService,
    private readonly config: AppConfig,
    storage: StorageService,
    private readonly repository: MediaRepository,
  ) {
    super(prisma, HARD_DELETE_LOCK_ID, config, storage);
  }

  protected async work(): Promise<number> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.config.jobs.hardDeleteGraceSeconds * 1000);
    const rows = await this.repository.findReadyForHardDelete(cutoff, now, BATCH_SIZE);
    return this.forEachRemoved(rows, (row) =>
      this.repository.markHardDeleted(row.id, row.deletedAt ?? now),
    );
  }
}
