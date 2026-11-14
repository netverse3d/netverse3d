import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantWebhookResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() url: string;
  @ApiProperty({ enum: ['active', 'paused', 'disabled'] }) status: string;
  @ApiProperty({ type: [String] }) subscribed_events: string[];
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) last_success_at: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) last_failure_at: Date | null;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

export class TenantWebhookSecretResponseDto extends TenantWebhookResponseDto {
  @ApiProperty({ description: 'Signing secret, returned only once' }) raw_secret: string;
}
