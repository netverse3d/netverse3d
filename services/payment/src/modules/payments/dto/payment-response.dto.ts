import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MINOR_UNIT_DESCRIPTION =
  'Amount in minor units; a string when it exceeds the safe integer range';

export class PaymentAttemptResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() payment_intent_id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) provider_account_id: string | null;
  @ApiProperty() provider_code: string;
  @ApiPropertyOptional({ type: String, nullable: true }) provider_payment_id: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) provider_order_id: string | null;
  @ApiProperty({ enum: ['card', 'bank_transfer', 'ewallet', 'qr_code', 'manual'] })
  payment_method_type: string;
  @ApiProperty({
    enum: [
      'pending',
      'requires_action',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'expired',
    ],
  })
  status: string;
  @ApiPropertyOptional({ type: String, nullable: true }) checkout_url: string | null;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) order_number:
    number | string;
  @ApiPropertyOptional({ type: String, nullable: true }) qr_payload: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) request_payload: unknown;
  @ApiPropertyOptional({ type: Object, nullable: true }) response_payload: unknown;
  @ApiPropertyOptional({ type: String, nullable: true }) failure_code: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) failure_message: string | null;
  @ApiProperty({ format: 'date-time' }) started_at: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) completed_at: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) expires_at: Date | null;
  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'Next step for the payer: redirect or QR',
  })
  next_action: unknown;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

export class PaymentIntentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) customer_id: string | null;
  @ApiProperty() public_id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) merchant_reference: string | null;
  @ApiProperty() target_type: string;
  @ApiProperty() target_ref: string;
  @ApiProperty({ type: Object }) target_snapshot: unknown;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ example: 'VND' }) currency: string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) subtotal_minor:
    number | string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) discount_minor:
    number | string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) fee_minor: number | string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) tax_minor: number | string;
  @ApiProperty({ type: 'integer', description: MINOR_UNIT_DESCRIPTION }) total_minor:
    number | string;
  @ApiProperty({
    enum: [
      'pending',
      'requires_action',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'expired',
      'partially_refunded',
      'refunded',
    ],
  })
  status: string;
  @ApiPropertyOptional({ type: Object, nullable: true }) metadata_json: unknown;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) paid_at: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) expires_at: Date | null;
  @ApiProperty({ type: [PaymentAttemptResponseDto] }) attempts: PaymentAttemptResponseDto[];
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

export class CheckoutMethodResponseDto {
  @ApiProperty({ example: 'vietqr' }) code: string;
  @ApiProperty({ enum: ['redirect', 'qr'] }) flow: string;
}

export class CheckoutMethodsResponseDto {
  @ApiProperty({ type: [CheckoutMethodResponseDto] }) methods: CheckoutMethodResponseDto[];
}
