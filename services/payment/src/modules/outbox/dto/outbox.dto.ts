import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '@app/common/pagination/pagination-query.dto';

export class DispatchOutboxDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class DeadDeliveryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class OutboxDispatchResponseDto {
  @ApiProperty() fannedOut: number;
  @ApiProperty() attempted: number;
  @ApiProperty() delivered: number;
  @ApiProperty() retrying: number;
  @ApiProperty() dead: number;
}

export class DeadDeliveryEndpointDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiProperty() status: string;
}

export class DeadDeliveryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: 'integer' }) outbox_event_id: number | string;
  @ApiProperty() endpoint_id: string;
  @ApiProperty() tenant_id: string;
  @ApiProperty() status: string;
  @ApiProperty() attempt_count: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) last_http_status: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) last_error: string | null;
  @ApiProperty({ type: DeadDeliveryEndpointDto }) endpoint: DeadDeliveryEndpointDto;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

export class RetryDeliveryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() requeued: boolean;
}
