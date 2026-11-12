import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class IssueDownloadUrlDto {
  @ApiPropertyOptional({ minimum: 60, maximum: 3600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  ttlSeconds?: number;

  @ApiPropertyOptional({ example: 'inline; filename="photo.jpg"', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contentDisposition?: string;
}
