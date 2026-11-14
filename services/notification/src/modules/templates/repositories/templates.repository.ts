import { Injectable } from '@nestjs/common';
import { NotificationTemplate, Prisma } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DeliveryChannelName } from '../../notifications/domain/channels';

import type { TemplateCategoryName } from '../domain/template-category';

export type TemplateRow = NotificationTemplate;
export type TemplateOrderBy = Prisma.NotificationTemplateOrderByWithRelationInput;

export interface NewTemplate {
  tenantId: string;
  eventType: string;
  channel: DeliveryChannelName;
  locale: string;
  subject: string;
  body: string;
  category: TemplateCategoryName;
}

export interface TemplateFilter {
  eventType?: string;
  channel?: DeliveryChannelName;
  locale?: string;
}

export function isTemplateKeyConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewTemplate): Promise<TemplateRow> {
    return this.prisma.notificationTemplate.create({ data });
  }

  findOwned(id: string, tenantId: string): Promise<TemplateRow | null> {
    return this.prisma.notificationTemplate.findFirst({ where: { id, tenantId } });
  }

  findPage(
    tenantId: string,
    filter: TemplateFilter,
    orderBy: TemplateOrderBy,
    skip: number,
    take: number,
  ): Promise<[TemplateRow[], number]> {
    const where: Prisma.NotificationTemplateWhereInput = { tenantId, ...filter };
    return this.prisma.$transaction([
      this.prisma.notificationTemplate.findMany({ where, orderBy, skip, take }),
      this.prisma.notificationTemplate.count({ where }),
    ]);
  }

  async updateOwned(
    id: string,
    tenantId: string,
    changes: { subject?: string; body?: string; category?: TemplateCategoryName },
  ): Promise<TemplateRow | null> {
    const { count } = await this.prisma.notificationTemplate.updateMany({
      where: { id, tenantId },
      data: { ...changes, version: { increment: 1 } },
    });
    return count > 0 ? this.findOwned(id, tenantId) : null;
  }

  async deleteOwned(id: string, tenantId: string): Promise<boolean> {
    const { count } = await this.prisma.notificationTemplate.deleteMany({
      where: { id, tenantId },
    });
    return count > 0;
  }

  findCandidates(
    tenantId: string,
    eventType: string,
    channel: DeliveryChannelName,
    locales: string[],
  ): Promise<TemplateRow[]> {
    return this.prisma.notificationTemplate.findMany({
      where: { tenantId, eventType, channel, locale: { in: locales } },
    });
  }

  async channelsWithTemplate(tenantId: string, eventType: string): Promise<DeliveryChannelName[]> {
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { tenantId, eventType },
      distinct: ['channel'],
      select: { channel: true },
    });
    return rows.map((row) => row.channel);
  }
}
