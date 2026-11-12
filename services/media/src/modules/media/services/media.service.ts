import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { ErrorCode, ErrorCodeDefinition } from '@netverse/nest-kit';
import { resolveError } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { resolveSort } from '@netverse/nest-kit';
import { AppConfig, UploadPolicy } from '../../../config/app-config';
import { StorageObjectMissingError } from '../../../infrastructure/storage/storage.errors';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { OutboxRepository } from '@netverse/nest-kit';
import {
  canChange,
  canDownload,
  canModerate,
  canRead,
  canUploadSystemAsset,
  listScopeFor,
  ownsUploadTarget,
} from '../domain/media-access';
import { normalizeContentType, objectFileName } from '../domain/object-file-name';
import { assertContentTypeAllowed, assertSizeAllowed } from '../domain/upload-policy';
import { IssueDownloadUrlDto } from '../dto/issue-download-url.dto';
import { IssueUploadUrlDto, MediaClassValue } from '../dto/issue-upload-url.dto';
import { ListMediaQueryDto } from '../dto/list-media-query.dto';
import {
  DownloadUrlResponseDto,
  MediaResponseDto,
  PromoteBatchResponseDto,
  UploadUrlResponseDto,
} from '../dto/media-response.dto';
import { ModerateMediaDto } from '../dto/moderate-media.dto';
import { PromoteBatchDto, PromoteMediaDto } from '../dto/promote-media.dto';
import { MediaErrorCode } from '../media-error-codes';
import {
  isUniqueViolation,
  MediaRepository,
  MediaRow,
  MediaTransaction,
} from '../repositories/media.repository';

const SORTABLE_FIELDS = ['createdAt', 'completedAt', 'declaredSizeBytes'] as const;
const NO_TENANT_SEGMENT = '_';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
  return `{${entries.join(',')}}`;
}

function invalidUpload(message: string): AppException {
  return new AppException(MediaErrorCode.INVALID_UPLOAD, { message });
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly repository: MediaRepository,
    private readonly outbox: OutboxRepository,
    private readonly storage: StorageService,
  ) {}

  async issueUploadUrl(
    dto: IssueUploadUrlDto,
    idempotencyKey: string | undefined,
    actor: Actor,
  ): Promise<UploadUrlResponseDto> {
    this.assertUploadRequest(dto, actor);
    if (!idempotencyKey) {
      return this.toUploadResponse(await this.createPending(dto, actor));
    }

    const scope = `${actor.tenantId ?? ''}:${actor.subject}`;
    const requestHash = createHash('sha256').update(canonicalJson(dto)).digest();
    const replay = await this.findReplay(scope, idempotencyKey, requestHash);
    if (replay) {
      return this.toUploadResponse(replay);
    }

    try {
      return this.toUploadResponse(
        await this.createPending(dto, actor, async (media, transaction) => {
          await this.repository.rememberIdempotency(
            scope,
            idempotencyKey,
            media.id,
            requestHash,
            transaction,
          );
        }),
      );
    } catch (error) {
      const raced = isUniqueViolation(error)
        ? await this.findReplay(scope, idempotencyKey, requestHash)
        : null;
      if (raced) {
        return this.toUploadResponse(raced);
      }
      throw error;
    }
  }

  async complete(id: string, actor: Actor): Promise<MediaResponseDto> {
    const media = await this.requireChangeable(id, actor);
    if (media.status !== 'PENDING') {
      throw new AppException(MediaErrorCode.ALREADY_COMPLETED);
    }

    const stored = await this.statUploadedObject(media);
    if (stored.size > this.policyFor(media.mediaClass).maxBytes) {
      await this.discardOversized(media);
      assertSizeAllowed(stored.size, this.policyFor(media.mediaClass));
    }
    if (normalizeContentType(stored.contentType) !== normalizeContentType(media.contentType)) {
      throw new AppException(MediaErrorCode.CONTENT_TYPE_MISMATCH, {
        details: { declared: media.contentType, uploaded: stored.contentType },
      });
    }

    const completed = await this.repository.transaction(async (transaction) => {
      const updated = await this.repository.updateIfStatus(
        id,
        'PENDING',
        {
          status: 'ACTIVE',
          actualSizeBytes: BigInt(stored.size),
          completedAt: new Date(),
          moderationStatus: this.initialModeration(media.mediaClass),
        },
        transaction,
      );
      if (!updated) {
        throw new AppException(MediaErrorCode.ALREADY_COMPLETED);
      }
      await this.emit('media.completed', updated, transaction);
      return updated;
    });
    return MediaResponseDto.from(completed);
  }

  async issueDownloadUrl(
    id: string,
    dto: IssueDownloadUrlDto,
    actor: Actor,
  ): Promise<DownloadUrlResponseDto> {
    const media = await this.requireReadable(id, actor);
    if (media.status !== 'ACTIVE') {
      throw new AppException(MediaErrorCode.NOT_ACTIVE);
    }
    if (!canDownload(media, actor)) {
      throw new AppException(MediaErrorCode.MODERATION_BLOCKED);
    }
    const ttlSeconds = dto.ttlSeconds ?? this.config.storage.downloadUrlTtlSeconds;
    const downloadUrl = await this.storage.presignDownload(
      media.bucket,
      media.objectKey,
      ttlSeconds,
      dto.contentDisposition,
    );
    return {
      downloadUrl,
      method: 'GET',
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async get(id: string, actor: Actor): Promise<MediaResponseDto> {
    return MediaResponseDto.from(await this.requireReadable(id, actor));
  }

  async list(query: ListMediaQueryDto, actor: Actor): Promise<PageResponseDto<MediaResponseDto>> {
    const orderBy = resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' });
    const [rows, total] = await this.repository.findPage(
      {
        ...listScopeFor(actor),
        ownerType: query.ownerType,
        ownerId: query.ownerId,
        mediaClass: query.mediaClass,
      },
      orderBy,
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(MediaResponseDto.from), query, total);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    const media = await this.requireChangeable(id, actor);
    if (media.status === 'DELETED') {
      return;
    }
    if (media.retentionUntil && media.retentionUntil > new Date()) {
      throw new AppException(MediaErrorCode.RETENTION_HOLD);
    }
    await this.repository.transaction(async (transaction) => {
      const deleted = await this.repository.update(
        id,
        { status: 'DELETED', deletedAt: new Date() },
        transaction,
      );
      await this.emit('media.deleted', deleted, transaction);
    });
  }

  async promote(id: string, dto: PromoteMediaDto, actor: Actor): Promise<MediaResponseDto> {
    const media = await this.requireChangeable(id, actor);
    if (media.lifecycle === 'PERMANENT') {
      return MediaResponseDto.from(media);
    }
    if (media.status !== 'ACTIVE') {
      throw new AppException(MediaErrorCode.NOT_ACTIVE);
    }
    if (media.expiresAt && media.expiresAt < new Date()) {
      throw new AppException(MediaErrorCode.EXPIRED);
    }

    const visibility = dto.visibility ?? media.visibility;
    const bucket = this.storage.permanentBucket(visibility);
    const objectKey = this.buildObjectKey(
      media.tenantId,
      dto.ownerType,
      dto.ownerId,
      media.originalFilename,
      media.contentType,
    );
    await this.storageCall(() =>
      this.storage.copy(media.bucket, media.objectKey, bucket, objectKey),
    );

    const promoted = await this.repository.transaction(async (transaction) => {
      const updated = await this.repository.update(
        id,
        {
          bucket,
          objectKey,
          previousObjectKey: media.objectKey,
          lifecycle: 'PERMANENT',
          expiresAt: null,
          ownerType: dto.ownerType,
          ownerId: dto.ownerId,
          visibility,
          retentionUntil: dto.retentionUntil ? new Date(dto.retentionUntil) : media.retentionUntil,
          promotedAt: new Date(),
          promotedBy: actor.subject,
          metadata: { ...(media.metadata as object), ...dto.metadataMerge } as object,
        },
        transaction,
      );
      await this.emit('media.promoted', updated, transaction);
      return updated;
    });

    await this.removeQuietly(media.bucket, media.objectKey);
    return MediaResponseDto.from(promoted);
  }

  async promoteBatch(dto: PromoteBatchDto, actor: Actor): Promise<PromoteBatchResponseDto> {
    const response: PromoteBatchResponseDto = { succeeded: [], failed: [] };
    for (const { mediaId, ...item } of dto.items) {
      try {
        response.succeeded.push(await this.promote(mediaId, item, actor));
      } catch (error) {
        const resolved = resolveError(error);
        response.failed.push({ mediaId, errorCode: resolved.code, message: resolved.message });
      }
    }
    return response;
  }

  async moderate(id: string, dto: ModerateMediaDto, actor: Actor): Promise<MediaResponseDto> {
    if (!canModerate(actor)) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
    const media = await this.requireReadable(id, actor);
    if (media.mediaClass !== 'USER_CONTENT') {
      throw invalidUpload('Only user content can be moderated');
    }
    const moderated = await this.repository.transaction(async (transaction) => {
      const updated = await this.repository.update(
        id,
        {
          moderationStatus: dto.decision,
          moderatedBy: actor.subject,
          moderatedAt: new Date(),
          moderationReason: dto.reason ?? null,
        },
        transaction,
      );
      await this.emit('media.moderated', updated, transaction);
      return updated;
    });
    return MediaResponseDto.from(moderated);
  }

  private assertUploadRequest(dto: IssueUploadUrlDto, actor: Actor): void {
    if (dto.mediaClass === 'SYSTEM_ASSET' && !canUploadSystemAsset(actor)) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
    const policy = this.policyFor(dto.mediaClass);
    assertContentTypeAllowed(dto.contentType, policy);
    assertSizeAllowed(dto.declaredSizeBytes, policy);

    if (dto.temporary) {
      if (dto.retentionUntil)
        throw invalidUpload('retentionUntil cannot be set on temporary uploads');
      if (dto.ownerType || dto.ownerId)
        throw invalidUpload('owner cannot be set on temporary uploads');
      if (dto.visibility !== 'PRIVATE') throw invalidUpload('temporary uploads must be PRIVATE');
      return;
    }
    if (dto.declaredSizeBytes < 1)
      throw invalidUpload('declaredSizeBytes must be at least 1 for permanent uploads');
    if (!dto.ownerType || !dto.ownerId)
      throw invalidUpload('ownerType and ownerId are required for permanent uploads');
    if (!ownsUploadTarget(actor, dto.ownerId)) {
      throw new AppException(ErrorCode.FORBIDDEN);
    }
  }

  private policyFor(mediaClass: MediaClassValue): UploadPolicy {
    return mediaClass === 'SYSTEM_ASSET'
      ? this.config.media.systemAsset
      : this.config.media.userContent;
  }

  private initialModeration(mediaClass: MediaClassValue): MediaRow['moderationStatus'] {
    return mediaClass === 'USER_CONTENT' && this.config.media.userContentRequiresReview
      ? 'PENDING'
      : 'NOT_REQUIRED';
  }

  private buildObjectKey(
    tenantId: string | null,
    ownerType: string,
    ownerId: string,
    originalFilename: string | null | undefined,
    contentType: string,
  ): string {
    const safeOwner = (value: string) => encodeURIComponent(value);
    return [
      tenantId ? safeOwner(tenantId) : NO_TENANT_SEGMENT,
      safeOwner(ownerType),
      safeOwner(ownerId),
      randomUUID(),
      objectFileName(originalFilename, contentType),
    ].join('/');
  }

  private async findReplay(
    scope: string,
    key: string,
    requestHash: Buffer,
  ): Promise<MediaRow | null> {
    const existing = await this.repository.findIdempotent(scope, key);
    if (!existing) {
      return null;
    }
    if (!Buffer.from(existing.requestHash).equals(requestHash)) {
      throw new AppException(MediaErrorCode.IDEMPOTENCY_KEY_REUSED);
    }
    return existing.media;
  }

  private createPending(
    dto: IssueUploadUrlDto,
    actor: Actor,
    afterCreate?: (media: MediaRow, transaction: MediaTransaction) => Promise<void>,
  ): Promise<MediaRow> {
    const objectKey = dto.temporary
      ? this.buildObjectKey(
          actor.tenantId,
          'temporary',
          actor.subject,
          dto.originalFilename,
          dto.contentType,
        )
      : this.buildObjectKey(
          actor.tenantId,
          dto.ownerType as string,
          dto.ownerId as string,
          dto.originalFilename,
          dto.contentType,
        );

    return this.repository.transaction(async (transaction) => {
      const media = await this.repository.create(
        {
          tenantId: actor.tenantId,
          mediaClass: dto.mediaClass,
          ownerType: dto.temporary ? null : dto.ownerType,
          ownerId: dto.temporary ? null : dto.ownerId,
          bucket: dto.temporary
            ? this.storage.tempBucket
            : this.storage.permanentBucket(dto.visibility),
          objectKey,
          contentType: dto.contentType,
          declaredSizeBytes: BigInt(dto.declaredSizeBytes),
          originalFilename: dto.originalFilename,
          visibility: dto.visibility,
          lifecycle: dto.temporary ? 'TEMPORARY' : 'PERMANENT',
          expiresAt: dto.temporary ? new Date(Date.now() + dto.ttlHours * 3_600_000) : null,
          retentionUntil: dto.retentionUntil ? new Date(dto.retentionUntil) : null,
          createdBy: actor.subject,
          metadata: (dto.metadata ?? {}) as object,
        },
        transaction,
      );
      await afterCreate?.(media, transaction);
      return media;
    });
  }

  private async toUploadResponse(media: MediaRow): Promise<UploadUrlResponseDto> {
    const uploadUrl = await this.storageCall(() =>
      this.storage.presignUpload(media.bucket, media.objectKey),
    );
    return {
      mediaId: media.id,
      lifecycle: media.lifecycle,
      uploadUrl,
      method: 'PUT',
      uploadUrlExpiresAt: new Date(
        Date.now() + this.config.storage.uploadUrlTtlSeconds * 1000,
      ).toISOString(),
      mediaExpiresAt: media.expiresAt?.toISOString() ?? null,
      requiredHeaders: { 'Content-Type': media.contentType },
    };
  }

  private async statUploadedObject(
    media: MediaRow,
  ): Promise<{ size: number; contentType: string }> {
    try {
      return await this.storage.stat(media.bucket, media.objectKey);
    } catch (error) {
      if (error instanceof StorageObjectMissingError) {
        throw new AppException(MediaErrorCode.OBJECT_MISSING);
      }
      this.logger.error(error instanceof Error ? error : String(error));
      throw new AppException(MediaErrorCode.STORAGE_UNAVAILABLE);
    }
  }

  private async discardOversized(media: MediaRow): Promise<void> {
    await this.removeQuietly(media.bucket, media.objectKey);
    await this.repository.transaction((transaction) =>
      this.repository.update(media.id, { status: 'DELETED', deletedAt: new Date() }, transaction),
    );
  }

  private async storageCall<T>(
    call: () => Promise<T>,
    failure: ErrorCodeDefinition = MediaErrorCode.STORAGE_UNAVAILABLE,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      this.logger.error(error instanceof Error ? error : String(error));
      throw new AppException(failure);
    }
  }

  private async removeQuietly(bucket: string, key: string): Promise<void> {
    try {
      await this.storage.remove(bucket, key);
    } catch (error) {
      this.logger.warn(
        `could not remove ${bucket}/${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async requireReadable(id: string, actor: Actor): Promise<MediaRow> {
    const media = await this.repository.findById(id);
    if (!media || !canRead(media, actor)) {
      throw new AppException(MediaErrorCode.NOT_FOUND);
    }
    return media;
  }

  private async requireChangeable(id: string, actor: Actor): Promise<MediaRow> {
    const media = await this.repository.findById(id);
    if (!media || !canChange(media, actor)) {
      throw new AppException(MediaErrorCode.NOT_FOUND);
    }
    return media;
  }

  private emit(type: string, media: MediaRow, transaction: MediaTransaction): Promise<void> {
    return this.outbox.enqueue(
      {
        type,
        aggregateId: media.id,
        tenantId: media.tenantId,
        payload: {
          mediaId: media.id,
          mediaClass: media.mediaClass,
          status: media.status,
          lifecycle: media.lifecycle,
          moderationStatus: media.moderationStatus,
          ownerType: media.ownerType,
          ownerId: media.ownerId,
          contentType: media.contentType,
          createdBy: media.createdBy,
        },
      },
      transaction,
    );
  }
}
