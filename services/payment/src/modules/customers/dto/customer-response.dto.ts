import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() customer_ref: string;
  @ApiPropertyOptional({ type: String, nullable: true }) email: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) full_name: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) phone: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) metadata_json: unknown;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}
