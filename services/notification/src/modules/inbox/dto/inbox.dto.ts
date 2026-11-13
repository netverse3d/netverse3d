import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@netverse/nest-kit';
import type { InboxItemRow } from '../repositories/inbox.repository';

export class InboxQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : (value as unknown),
  )
  @IsBoolean()
  unreadOnly?: boolean;
}

export class InboxItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(row: InboxItemRow): InboxItemResponseDto {
    return {
      id: row.id,
      eventType: row.eventType,
      title: row.title,
      body: row.body,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export class UnreadCountResponseDto {
  @ApiProperty()
  count: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty()
  updated: number;
}
