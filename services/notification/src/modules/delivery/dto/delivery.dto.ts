import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@netverse/nest-kit';
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  type DeliveryChannelName,
  type DeliveryStatusName,
} from '../../notifications/domain/channels';
import { MAX_EVENT_TYPE_LENGTH } from '../../notifications/domain/limits';
import type { DeliveryRow } from '../repositories/delivery.repository';

export class DeliveryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DELIVERY_STATUSES })
  @IsOptional()
  @IsEnum(DELIVERY_STATUSES)
  status?: DeliveryStatusName;

  @ApiPropertyOptional({ maxLength: MAX_EVENT_TYPE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  eventType?: string;
}

export class DeliveryLogEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  notificationId: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ enum: DELIVERY_CHANNELS })
  channel: DeliveryChannelName;

  @ApiProperty({ type: String, nullable: true })
  destination: string | null;

  @ApiProperty({ enum: DELIVERY_STATUSES })
  status: DeliveryStatusName;

  @ApiProperty()
  attempts: number;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ type: String, nullable: true })
  detail: string | null;

  @ApiProperty({ type: Number, nullable: true })
  templateVersion: number | null;

  @ApiProperty({ format: 'date-time' })
  nextAttemptAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  static from(row: DeliveryRow): DeliveryLogEntryDto {
    return {
      id: row.id,
      notificationId: row.notificationId,
      eventType: row.eventType,
      channel: row.channel,
      destination: row.destination,
      status: row.status,
      attempts: row.attempts,
      reason: row.reason,
      detail: row.detail,
      templateVersion: row.templateVersion,
      nextAttemptAt: row.nextAttemptAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
