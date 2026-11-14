import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { provider_account_status } from '@app/infrastructure/prisma/client';
import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProviderAccountDto {
  @ApiPropertyOptional({ enum: Object.values(provider_account_status) })
  @IsOptional()
  @IsIn(Object.values(provider_account_status))
  status?: provider_account_status;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  accountLabel?: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ReplaceProviderCredentialsDto {
  @ApiProperty({ type: Object, additionalProperties: true })
  @IsObject()
  credentials!: Record<string, unknown>;
}
