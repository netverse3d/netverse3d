import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DELIVERY_CHANNELS, type DeliveryChannelName } from '../../notifications/domain/channels';
import {
  EVENT_TYPE_PATTERN,
  MAX_BLOCK_REASON_LENGTH,
  MAX_BLOCKED_ADDRESS_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
} from '../../notifications/domain/limits';
import type { BlockedAddressRow, OptOutRow } from '../repositories/preferences.repository';

export class OptOutKeyDto {
  @ApiProperty({ enum: DELIVERY_CHANNELS })
  @IsEnum(DELIVERY_CHANNELS)
  channel: DeliveryChannelName;

  @ApiProperty({ example: 'account.welcome', maxLength: MAX_EVENT_TYPE_LENGTH })
  @IsString()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  @Matches(EVENT_TYPE_PATTERN)
  eventType: string;
}

export class OptOutResponseDto {
  @ApiProperty({ enum: DELIVERY_CHANNELS })
  channel: DeliveryChannelName;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(row: OptOutRow): OptOutResponseDto {
    return {
      channel: row.channel,
      eventType: row.eventType,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export class OptOutListResponseDto {
  @ApiProperty({ type: [OptOutResponseDto] })
  optOuts: OptOutResponseDto[];
}

export class BlockAddressDto {
  @ApiProperty({ maxLength: MAX_BLOCKED_ADDRESS_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BLOCKED_ADDRESS_LENGTH)
  address: string;

  @ApiPropertyOptional({ maxLength: MAX_BLOCK_REASON_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BLOCK_REASON_LENGTH)
  reason?: string;
}

export class BlockedAddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(row: BlockedAddressRow): BlockedAddressResponseDto {
    return {
      id: row.id,
      address: row.address,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
