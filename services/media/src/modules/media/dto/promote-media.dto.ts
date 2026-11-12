import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { MEDIA_VISIBILITIES, MediaVisibilityValue } from './issue-upload-url.dto';

export const MAX_PROMOTE_BATCH = 50;

export class PromoteMediaDto {
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @Length(1, 64)
  ownerType: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @Length(1, 255)
  ownerId: string;

  @ApiPropertyOptional({ enum: MEDIA_VISIBILITIES })
  @IsOptional()
  @IsIn(MEDIA_VISIBILITIES)
  visibility?: MediaVisibilityValue;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  retentionUntil?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadataMerge?: Record<string, unknown>;
}

export class PromoteBatchItemDto extends PromoteMediaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  mediaId: string;
}

export class PromoteBatchDto {
  @ApiProperty({ type: [PromoteBatchItemDto], minItems: 1, maxItems: MAX_PROMOTE_BATCH })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PROMOTE_BATCH)
  @ValidateNested({ each: true })
  @Type(() => PromoteBatchItemDto)
  items: PromoteBatchItemDto[];
}
