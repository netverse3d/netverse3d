import { Injectable } from '@nestjs/common';
import {
  Database,
  DatabaseTransaction,
  OutboxEventRow,
} from '../../../infrastructure/database/database';

export type OutboxTransaction = Pick<DatabaseTransaction, 'outboxEvent'>;
export type OutboxRow = OutboxEventRow;

export interface NewOutboxEvent {
  type: string;
  aggregateId: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly database: Database) {}

  async enqueue(event: NewOutboxEvent, transaction: OutboxTransaction): Promise<void> {
    await transaction.outboxEvent.create({ data: event });
  }

  async findPendingInOrder(limit: number): Promise<OutboxRow[]> {
    return this.database.outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.database.outboxEvent.update({
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
    await this.database.outboxEvent.update({
      where: { id },
      data: {
        attempts,
        lastError,
        ...(nextAttemptAt ? { nextAttemptAt } : { status: 'DEAD' }),
      },
    });
  }
}
