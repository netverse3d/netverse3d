import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookIngestResponseDto {
  @ApiProperty() duplicate: boolean;
  @ApiProperty() webhookEventId: string;
  @ApiPropertyOptional() skipped?: boolean;
  @ApiPropertyOptional() ignored?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) reason?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) previousStatus?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) previousReason?: string | null;
  @ApiPropertyOptional() paymentIntentId?: string;
  @ApiPropertyOptional() publicId?: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) outboxEventId?: string | null;
}
