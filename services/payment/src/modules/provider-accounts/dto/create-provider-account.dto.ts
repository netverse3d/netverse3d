import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateProviderAccountDto {
  @ApiProperty()
  @IsString()
  @Length(1, 40)
  providerCode!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  accountLabel!: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  @IsObject()
  credentials!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'DEMOV210' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/^[A-Za-z0-9._-]+$/)
  externalAccountRef?: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
