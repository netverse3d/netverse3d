import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@netverse/nest-kit';
import { DELIVERY_CHANNELS, type DeliveryChannelName } from '../../notifications/domain/channels';
import {
  EVENT_TYPE_PATTERN,
  LOCALE_PATTERN,
  MAX_EVENT_TYPE_LENGTH,
  MAX_LOCALE_LENGTH,
  MAX_TEMPLATE_BODY_LENGTH,
  MAX_TEMPLATE_SUBJECT_LENGTH,
} from '../../notifications/domain/limits';
import { TEMPLATE_CATEGORIES, type TemplateCategoryName } from '../domain/template-category';

export class CreateTemplateDto {
  @ApiProperty({ example: 'account.welcome', maxLength: MAX_EVENT_TYPE_LENGTH })
  @IsString()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  @Matches(EVENT_TYPE_PATTERN)
  eventType: string;

  @ApiProperty({ enum: DELIVERY_CHANNELS })
  @IsEnum(DELIVERY_CHANNELS)
  channel: DeliveryChannelName;

  @ApiProperty({ example: 'en', maxLength: MAX_LOCALE_LENGTH })
  @IsString()
  @MaxLength(MAX_LOCALE_LENGTH)
  @Matches(LOCALE_PATTERN)
  locale: string;

  @ApiProperty({
    description: 'Handlebars source of the subject or title',
    maxLength: MAX_TEMPLATE_SUBJECT_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEMPLATE_SUBJECT_LENGTH)
  subject: string;

  @ApiProperty({
    description: 'Handlebars source of the body',
    maxLength: MAX_TEMPLATE_BODY_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEMPLATE_BODY_LENGTH)
  body: string;

  @ApiPropertyOptional({
    enum: TEMPLATE_CATEGORIES,
    description: 'TRANSACTIONAL is always sent and exists only in the platform scope',
  })
  @IsOptional()
  @IsEnum(TEMPLATE_CATEGORIES)
  category?: TemplateCategoryName;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ maxLength: MAX_TEMPLATE_SUBJECT_LENGTH })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEMPLATE_SUBJECT_LENGTH)
  subject?: string;

  @ApiPropertyOptional({ maxLength: MAX_TEMPLATE_BODY_LENGTH })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEMPLATE_BODY_LENGTH)
  body?: string;

  @ApiPropertyOptional({
    enum: TEMPLATE_CATEGORIES,
    description: 'TRANSACTIONAL is always sent and exists only in the platform scope',
  })
  @IsOptional()
  @IsEnum(TEMPLATE_CATEGORIES)
  category?: TemplateCategoryName;
}

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: MAX_EVENT_TYPE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  eventType?: string;

  @ApiPropertyOptional({ enum: DELIVERY_CHANNELS })
  @IsOptional()
  @IsEnum(DELIVERY_CHANNELS)
  channel?: DeliveryChannelName;

  @ApiPropertyOptional({ maxLength: MAX_LOCALE_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOCALE_LENGTH)
  locale?: string;
}
