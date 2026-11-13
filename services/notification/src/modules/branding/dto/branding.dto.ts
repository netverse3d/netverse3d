import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { MAX_BRAND_KEY_LENGTH, MAX_BRAND_VALUE_LENGTH } from '../../notifications/domain/limits';
import type { BrandingRow } from '../repositories/branding.repository';

export class PutBrandingEntryDto {
  @ApiProperty({ maxLength: MAX_BRAND_VALUE_LENGTH })
  @IsString()
  @MaxLength(MAX_BRAND_VALUE_LENGTH)
  value: string;
}

export class BrandingEntryResponseDto {
  @ApiProperty({ example: 'logoUrl', maxLength: MAX_BRAND_KEY_LENGTH })
  key: string;

  @ApiProperty()
  value: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  static from(row: BrandingRow): BrandingEntryResponseDto {
    return { key: row.key, value: row.value, updatedAt: row.updatedAt.toISOString() };
  }
}

export class BrandingResponseDto {
  @ApiProperty({ type: [BrandingEntryResponseDto] })
  entries: BrandingEntryResponseDto[];
}
