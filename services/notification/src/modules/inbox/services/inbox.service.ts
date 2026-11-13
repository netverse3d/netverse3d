import { Injectable } from '@nestjs/common';
import type { Actor } from '@netverse/nest-kit';
import { AppException } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { resolveSort } from '@netverse/nest-kit';
import { scopeOf } from '@netverse/nest-kit';
import { NotificationErrorCode } from '../../notifications/notification-error-codes';
import {
  InboxItemResponseDto,
  InboxQueryDto,
  MarkAllReadResponseDto,
  UnreadCountResponseDto,
} from '../dto/inbox.dto';
import { InboxRepository } from '../repositories/inbox.repository';

const SORTABLE_FIELDS = ['createdAt'] as const;

@Injectable()
export class InboxService {
  constructor(private readonly repository: InboxRepository) {}

  async list(query: InboxQueryDto, actor: Actor): Promise<PageResponseDto<InboxItemResponseDto>> {
    const orderBy = resolveSort(query.sort, SORTABLE_FIELDS, { createdAt: 'desc' });
    const [rows, total] = await this.repository.findPage(
      scopeOf(actor),
      actor.subject,
      query.unreadOnly ?? false,
      orderBy,
      query.skip,
      query.take,
    );
    return PageResponseDto.of(rows.map(InboxItemResponseDto.from), query, total);
  }

  async unreadCount(actor: Actor): Promise<UnreadCountResponseDto> {
    return { count: await this.repository.countUnread(scopeOf(actor), actor.subject) };
  }

  async markRead(id: string, actor: Actor): Promise<InboxItemResponseDto> {
    const row = await this.repository.markRead(id, scopeOf(actor), actor.subject);
    if (!row) {
      throw new AppException(NotificationErrorCode.INBOX_ITEM_NOT_FOUND);
    }
    return InboxItemResponseDto.from(row);
  }

  async markAllRead(actor: Actor): Promise<MarkAllReadResponseDto> {
    return { updated: await this.repository.markAllRead(scopeOf(actor), actor.subject) };
  }
}
