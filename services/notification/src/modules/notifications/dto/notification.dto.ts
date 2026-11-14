import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DELIVERY_CHANNELS,
  DELIVERY_STATUSES,
  type DeliveryChannelName,
  type DeliveryStatusName,
} from '../domain/channels';
import {
  EVENT_TYPE_PATTERN,
  LOCALE_PATTERN,
  MAX_DEVICE_TOKENS,
  MAX_DEVICE_TOKEN_LENGTH,
  MAX_EMAIL_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
  MAX_LOCALE_LENGTH,
  MAX_SUBJECT_ID_LENGTH,
} from '../domain/limits';
import type { NotificationWithDeliveries } from '../repositories/notifications.repository';

export class RecipientDto {
  @ApiPropertyOptional({ maxLength: MAX_SUBJECT_ID_LENGTH })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_SUBJECT_ID_LENGTH)
  subject?: string;

  @ApiPropertyOptional({ maxLength: MAX_EMAIL_LENGTH })
  @IsOptional()
  @IsEmail()
  @MaxLength(MAX_EMAIL_LENGTH)
  email?: string;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_DEVICE_TOKENS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DEVICE_TOKENS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(MAX_DEVICE_TOKEN_LENGTH, { each: true })
  deviceTokens?: string[];
}

export class SendNotificationDto {
  @ApiProperty({ example: 'account.welcome', maxLength: MAX_EVENT_TYPE_LENGTH })
  @IsString()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  @Matches(EVENT_TYPE_PATTERN)
  eventType: string;

  @ApiProperty({ type: RecipientDto })
  @ValidateNested()
  @Type(() => RecipientDto)
  recipient: RecipientDto;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'en', maxLength: MAX_LOCALE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCALE_LENGTH)
  @Matches(LOCALE_PATTERN)
  locale?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'After this moment the notification is dropped instead of sent late',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @ApiPropertyOptional({ enum: DELIVERY_CHANNELS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(DELIVERY_CHANNELS, { each: true })
  channels?: DeliveryChannelName[];
}

export class DeliveryStateDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: DELIVERY_CHANNELS })
  channel: DeliveryChannelName;

  @ApiProperty({ enum: DELIVERY_STATUSES })
  status: DeliveryStatusName;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;
}

export class AcceptedNotificationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  locale: string;

  @ApiProperty({ type: [DeliveryStateDto] })
  deliveries: DeliveryStateDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(row: NotificationWithDeliveries): AcceptedNotificationDto {
    return {
      id: row.id,
      eventType: row.eventType,
      locale: row.locale,
      deliveries: row.deliveries.map((delivery) => ({
        id: delivery.id,
        channel: delivery.channel,
        status: delivery.status,
        reason: delivery.reason,
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
