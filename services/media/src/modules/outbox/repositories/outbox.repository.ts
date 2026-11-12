import { Injectable } from '@nestjs/common';
import { OutboxEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type OutboxTransaction = Prisma.TransactionClient;
export type OutboxRow = OutboxEvent;

export interface NewOutboxEvent {
  type: string;
  aggregateId: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(event: NewOutboxEvent, transaction: OutboxTransaction): Promise<void> {
    await transaction.outboxEvent.create({
      data: { ...event, payload: event.payload as Prisma.InputJsonObject },
    });
  }

  findDue(limit: number): Promise<OutboxRow[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), lastError: null },
    });
  }

  async markFailed(
    id: string,
    attempts: number,
    nextAttemptAt: Date | null,
    lastError: string,
  ): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts,
        lastError,
        ...(nextAttemptAt ? { nextAttemptAt } : { status: 'DEAD' }),
      },
    });
  }
}
