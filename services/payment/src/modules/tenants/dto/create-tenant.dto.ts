import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @Length(2, 60)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ default: 'VND' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
