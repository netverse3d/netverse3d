import { Injectable } from '@nestjs/common';
import type { ProcessedEvents } from '@netverse/nest-kit';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ProcessedEventsRepository implements ProcessedEvents {
  constructor(private readonly prisma: PrismaService) {}

  async has(eventId: string): Promise<boolean> {
    const row = await this.prisma.processedEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    });
    return row !== null;
  }

  async mark(eventId: string): Promise<void> {
    await this.prisma.processedEvent.createMany({ data: [{ eventId }], skipDuplicates: true });
  }
}
