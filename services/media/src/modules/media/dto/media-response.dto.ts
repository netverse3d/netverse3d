import { ApiProperty } from '@nestjs/swagger';
import type { MediaRow } from '../repositories/media.repository';

export class MediaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['SYSTEM_ASSET', 'USER_CONTENT'] })
  mediaClass: string;

  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'DELETED'] })
  status: string;

  @ApiProperty({ enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'] })
  visibility: string;

  @ApiProperty({ enum: ['TEMPORARY', 'PERMANENT'] })
  lifecycle: string;

  @ApiProperty({ enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'] })
  moderationStatus: string;

  @ApiProperty({ type: String, nullable: true })
  ownerType: string | null;

  @ApiProperty({ type: String, nullable: true })
  ownerId: string | null;

  @ApiProperty()
  contentType: string;

  @ApiProperty()
  declaredSizeBytes: number;

  @ApiProperty({ type: Number, nullable: true })
  actualSizeBytes: number | null;

  @ApiProperty({ type: String, nullable: true })
  originalFilename: string | null;

  @ApiProperty()
  createdBy: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  expiresAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  retentionUntil: string | null;

  @ApiProperty({ type: Object })
  metadata: unknown;

  static from(row: MediaRow): MediaResponseDto {
    return {
      id: row.id,
      mediaClass: row.mediaClass,
      status: row.status,
      visibility: row.visibility,
      lifecycle: row.lifecycle,
      moderationStatus: row.moderationStatus,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      contentType: row.contentType,
      declaredSizeBytes: Number(row.declaredSizeBytes),
      actualSizeBytes: row.actualSizeBytes === null ? null : Number(row.actualSizeBytes),
      originalFilename: row.originalFilename,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      retentionUntil: row.retentionUntil?.toISOString() ?? null,
      metadata: row.metadata,
    };
  }
}

export class UploadUrlResponseDto {
  @ApiProperty({ format: 'uuid' })
  mediaId: string;

  @ApiProperty({ enum: ['TEMPORARY', 'PERMANENT'] })
  lifecycle: string;

  @ApiProperty()
  uploadUrl: string;

  @ApiProperty({ example: 'PUT' })
  method: string;

  @ApiProperty({ format: 'date-time' })
  uploadUrlExpiresAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  mediaExpiresAt: string | null;

  @ApiProperty({ type: Object, example: { 'Content-Type': 'image/png' } })
  requiredHeaders: Record<string, string>;
}

export class DownloadUrlResponseDto {
  @ApiProperty()
  downloadUrl: string;

  @ApiProperty({ example: 'GET' })
  method: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export class PromoteBatchFailureDto {
  @ApiProperty({ format: 'uuid' })
  mediaId: string;

  @ApiProperty({ example: 'MEDIA.NOT_FOUND' })
  errorCode: string;

  @ApiProperty()
  message: string;
}

export class PromoteBatchResponseDto {
  @ApiProperty({ type: [MediaResponseDto] })
  succeeded: MediaResponseDto[];

  @ApiProperty({ type: [PromoteBatchFailureDto] })
  failed: PromoteBatchFailureDto[];
}
