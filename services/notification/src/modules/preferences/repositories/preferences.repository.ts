import { Injectable } from '@nestjs/common';
import { BlockedAddress, Prisma, RecipientOptOut } from '../../../infrastructure/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { DeliveryChannelName } from '../../notifications/domain/channels';

export type OptOutRow = RecipientOptOut;
export type BlockedAddressRow = BlockedAddress;

export interface OptOutKey {
  tenantId: string;
  subject: string;
  channel: DeliveryChannelName;
  eventType: string;
}

export function isBlockedAddressConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOptOuts(tenantId: string, subject: string): Promise<OptOutRow[]> {
    return this.prisma.recipientOptOut.findMany({
      where: { tenantId, subject },
      orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
    });
  }

  upsertOptOut(key: OptOutKey): Promise<OptOutRow> {
    return this.prisma.recipientOptOut.upsert({
      where: { tenantId_subject_channel_eventType: key },
      create: key,
      update: {},
    });
  }

  async deleteOptOut(key: OptOutKey): Promise<boolean> {
    const { count } = await this.prisma.recipientOptOut.deleteMany({ where: key });
    return count > 0;
  }

  async optOutExists(key: OptOutKey): Promise<boolean> {
    return (await this.prisma.recipientOptOut.count({ where: key })) > 0;
  }

  async addressIsBlocked(tenantId: string, address: string): Promise<boolean> {
    return (await this.prisma.blockedAddress.count({ where: { tenantId, address } })) > 0;
  }

  createBlockedAddress(data: {
    tenantId: string;
    address: string;
    reason: string | null;
    createdBy: string;
  }): Promise<BlockedAddressRow> {
    return this.prisma.blockedAddress.create({ data });
  }

  findBlockedPage(
    tenantId: string,
    skip: number,
    take: number,
  ): Promise<[BlockedAddressRow[], number]> {
    const where = { tenantId };
    return this.prisma.$transaction([
      this.prisma.blockedAddress.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.blockedAddress.count({ where }),
    ]);
  }

  async deleteBlockedAddress(id: string, tenantId: string): Promise<boolean> {
    const { count } = await this.prisma.blockedAddress.deleteMany({ where: { id, tenantId } });
    return count > 0;
  }
}
