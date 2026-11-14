import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantApiKeyResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() key_prefix: string;
  @ApiProperty() label: string;
  @ApiProperty({ enum: ['active', 'revoked', 'expired'] }) status: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) last_used_at: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) expires_at: Date | null;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

export class CreatedTenantApiKeyResponseDto extends TenantApiKeyResponseDto {
  @ApiProperty({ description: 'Raw API key, returned only once' }) raw_api_key: string;
}
