import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MODERATION_DECISIONS = ['APPROVED', 'REJECTED'] as const;

export class ModerateMediaDto {
  @ApiProperty({ enum: MODERATION_DECISIONS })
  @IsIn(MODERATION_DECISIONS)
  decision: (typeof MODERATION_DECISIONS)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
