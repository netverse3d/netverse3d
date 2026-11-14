import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { webhook_endpoint_status } from '@app/infrastructure/prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PAYMENT_EVENT_TYPES } from '@app/common/constants/payment-event-types';
import { IsPublicHttpsWebhookUrl } from '@app/common/utils/webhook-target.util';

export class CreateTenantWebhookDto {
  @ApiProperty()
  @IsString()
  @Length(1, 500)
  @IsPublicHttpsWebhookUrl()
  url!: string;

  @ApiProperty({ type: [String], enum: PAYMENT_EVENT_TYPES })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PAYMENT_EVENT_TYPES, { each: true })
  subscribedEvents!: string[];
}

export class UpdateTenantWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  @IsPublicHttpsWebhookUrl()
  url?: string;

  @ApiPropertyOptional({ type: [String], enum: PAYMENT_EVENT_TYPES })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(PAYMENT_EVENT_TYPES, { each: true })
  subscribedEvents?: string[];

  @ApiPropertyOptional({ enum: Object.values(webhook_endpoint_status) })
  @IsOptional()
  @IsIn(Object.values(webhook_endpoint_status))
  status?: webhook_endpoint_status;
}
