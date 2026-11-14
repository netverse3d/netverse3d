import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['active', 'suspended', 'archived'] }) status: string;
  @ApiProperty({ example: 'VND' }) default_currency: string;
  @ApiPropertyOptional({ type: Object, nullable: true }) metadata_json: unknown;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}
