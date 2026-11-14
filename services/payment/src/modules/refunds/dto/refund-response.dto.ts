import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MINOR_UNIT_DESCRIPTION =
  'Amount in minor units; a string when it exceeds the safe integer range';

export class RefundIntentSummaryDto {
  @ApiProperty() public_id: string;
  @ApiProperty() status: string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) total_minor:
    number | string;
}

export class RefundResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() payment_intent_id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) payment_attempt_id: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) customer_id: string | null;
  @ApiProperty() public_id: string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) amount_minor:
    number | string;
  @ApiProperty({ example: 'VND' }) currency: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reason: string | null;
  @ApiProperty({ enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled'] })
  status: string;
  @ApiPropertyOptional({ type: String, nullable: true }) provider_refund_id: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) completed_at: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) failed_at: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) failure_reason: string | null;
  @ApiPropertyOptional({ type: RefundIntentSummaryDto }) payment_intents?: RefundIntentSummaryDto;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}
