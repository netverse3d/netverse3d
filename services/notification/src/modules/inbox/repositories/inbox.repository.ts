import { Injectable } from '@nestjs/common';
import { InboxItem, Prisma } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type InboxItemRow = InboxItem;
export type InboxOrderBy = Prisma.InboxItemOrderByWithRelationInput;

export interface NewInboxItem {
  tenantId: string;
  subject: string;
  deliveryId: string;
  eventType: string;
  title: string;
  body: string;
}

@Injectable()
export class InboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  store(item: NewInboxItem): Promise<InboxItemRow> {
    return this.prisma.inboxItem.upsert({
      where: { deliveryId: item.deliveryId },
      create: item,
      update: {},
    });
  }

  findPage(
    tenantId: string,
    subject: string,
    unreadOnly: boolean,
    orderBy: InboxOrderBy,
    skip: number,
    take: number,
  ): Promise<[InboxItemRow[], number]> {
    const where: Prisma.InboxItemWhereInput = {
      tenantId,
      subject,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.inboxItem.findMany({ where, orderBy, skip, take }),
      this.prisma.inboxItem.count({ where }),
    ]);
  }

  countUnread(tenantId: string, subject: string): Promise<number> {
    return this.prisma.inboxItem.count({ where: { tenantId, subject, readAt: null } });
  }

  async markRead(id: string, tenantId: string, subject: string): Promise<InboxItemRow | null> {
    await this.prisma.inboxItem.updateMany({
      where: { id, tenantId, subject, readAt: null },
      data: { readAt: new Date() },
    });
    return this.prisma.inboxItem.findFirst({ where: { id, tenantId, subject } });
  }

  async markAllRead(tenantId: string, subject: string): Promise<number> {
    const { count } = await this.prisma.inboxItem.updateMany({
      where: { tenantId, subject, readAt: null },
      data: { readAt: new Date() },
    });
    return count;
  }
}
