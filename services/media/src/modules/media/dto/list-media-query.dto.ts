import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { MEDIA_CLASSES, MediaClassValue } from './issue-upload-url.dto';

export class ListMediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerType?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerId?: string;

  @ApiPropertyOptional({ enum: MEDIA_CLASSES })
  @IsOptional()
  @IsIn(MEDIA_CLASSES)
  mediaClass?: MediaClassValue;
}
