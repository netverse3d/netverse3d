import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProviderAccountCredentialsInfoDto {
  @ApiProperty({ enum: ['encrypted', 'plaintext'] }) storage: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) key_version: number | null;
  @ApiProperty({ type: [String] }) plaintext_keys: string[];
}

export class ProviderAccountResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() provider_code: string;
  @ApiProperty() account_label: string;
  @ApiPropertyOptional({ type: String, nullable: true }) external_account_ref: string | null;
  @ApiProperty({ enum: ['active', 'disabled'] }) status: string;
  @ApiPropertyOptional({ type: Object, nullable: true }) config_json: unknown;
  @ApiProperty({ type: ProviderAccountCredentialsInfoDto })
  credentials: ProviderAccountCredentialsInfoDto;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}
