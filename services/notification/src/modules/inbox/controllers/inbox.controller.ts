import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '@netverse/nest-kit';
import { CurrentActor } from '@netverse/nest-kit';
import { PageResponseDto } from '@netverse/nest-kit';
import { ApiEnvelope, ApiPagedEnvelope } from '@netverse/nest-kit';
import { Audit, AuditResourceInput } from '@netverse/nest-kit';
import {
  InboxItemResponseDto,
  InboxQueryDto,
  MarkAllReadResponseDto,
  UnreadCountResponseDto,
} from '../dto/inbox.dto';
import { InboxService } from '../services/inbox.service';

const inboxIdParam = ({ params }: AuditResourceInput) => params.id;

@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List the inbox of the signed-in user' })
  @ApiPagedEnvelope(InboxItemResponseDto)
  list(
    @Query() query: InboxQueryDto,
    @CurrentActor() actor: Actor,
  ): Promise<PageResponseDto<InboxItemResponseDto>> {
    return this.inbox.list(query, actor);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread inbox items of the signed-in user' })
  @ApiEnvelope(UnreadCountResponseDto)
  unreadCount(@CurrentActor() actor: Actor): Promise<UnreadCountResponseDto> {
    return this.inbox.unreadCount(actor);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'inbox.read_all', resourceType: 'inbox_item' })
  @ApiOperation({ summary: 'Mark every inbox item of the signed-in user as read' })
  @ApiEnvelope(MarkAllReadResponseDto)
  markAllRead(@CurrentActor() actor: Actor): Promise<MarkAllReadResponseDto> {
    return this.inbox.markAllRead(actor);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'inbox.read', resourceType: 'inbox_item', resourceId: inboxIdParam })
  @ApiOperation({ summary: 'Mark one inbox item as read' })
  @ApiEnvelope(InboxItemResponseDto)
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<InboxItemResponseDto> {
    return this.inbox.markRead(id, actor);
  }
}
