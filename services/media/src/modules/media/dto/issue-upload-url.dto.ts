import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export const MEDIA_CLASSES = ['SYSTEM_ASSET', 'USER_CONTENT'] as const;
export const MEDIA_VISIBILITIES = ['PRIVATE', 'INTERNAL', 'PUBLIC'] as const;

export type MediaClassValue = (typeof MEDIA_CLASSES)[number];
export type MediaVisibilityValue = (typeof MEDIA_VISIBILITIES)[number];

export class IssueUploadUrlDto {
  @ApiPropertyOptional({ enum: MEDIA_CLASSES, default: 'USER_CONTENT' })
  @IsOptional()
  @IsIn(MEDIA_CLASSES)
  mediaClass: MediaClassValue = 'USER_CONTENT';

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @Length(3, 128)
  contentType: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  declaredSizeBytes: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;

  @ApiPropertyOptional({ enum: MEDIA_VISIBILITIES, default: 'PRIVATE' })
  @IsOptional()
  @IsIn(MEDIA_VISIBILITIES)
  visibility: MediaVisibilityValue = 'PRIVATE';

  @ApiPropertyOptional({ description: 'Required for permanent uploads', maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  ownerType?: string;

  @ApiPropertyOptional({ description: 'Required for permanent uploads', maxLength: 255 })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  ownerId?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  retentionUntil?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  temporary: boolean = false;

  @ApiPropertyOptional({ minimum: 1, maximum: 720, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  ttlHours: number = 24;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
