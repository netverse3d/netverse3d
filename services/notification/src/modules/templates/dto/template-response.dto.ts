import { ApiProperty } from '@nestjs/swagger';
import { DELIVERY_CHANNELS, type DeliveryChannelName } from '../../notifications/domain/channels';
import { TEMPLATE_CATEGORIES, type TemplateCategoryName } from '../domain/template-category';
import type { TemplateRow } from '../repositories/templates.repository';

export class TemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty({ enum: DELIVERY_CHANNELS })
  channel: DeliveryChannelName;

  @ApiProperty()
  locale: string;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ enum: TEMPLATE_CATEGORIES })
  category: TemplateCategoryName;

  @ApiProperty()
  version: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  static from(row: TemplateRow): TemplateResponseDto {
    return {
      id: row.id,
      eventType: row.eventType,
      channel: row.channel,
      locale: row.locale,
      subject: row.subject,
      body: row.body,
      category: row.category,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
