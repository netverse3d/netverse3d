import { Injectable } from '@nestjs/common';
import { Prisma, payment_webhook_status } from '@app/infrastructure/prisma/client';
import { PrismaService } from '@app/infrastructure/prisma/prisma.service';
import { PrismaDb } from '@app/infrastructure/prisma/transaction-runner';

type WebhookEventInput = Prisma.payment_webhook_eventsUncheckedCreateInput;

@Injectable()
export class PaymentWebhookEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(data: WebhookEventInput, db: PrismaDb) {
    const key = this.uniqueKey(data);
    const inserted = await db.payment_webhook_events.createMany({
      data: [data],
      skipDuplicates: true,
    });
    if (inserted.count === 1) {
      return {
        row: await db.payment_webhook_events.findUniqueOrThrow({ where: key }),
        claimed: true,
      };
    }
    const reclaimed = await db.payment_webhook_events.updateMany({
      where: {
        provider_code: data.provider_code,
        provider_event_id: data.provider_event_id,
        status: 'failed',
      },
      data: { status: 'received', error_message: null },
    });
    return {
      row: await db.payment_webhook_events.findUniqueOrThrow({ where: key }),
      claimed: reclaimed.count === 1,
    };
  }

  markOutcome(
    id: string,
    status: Extract<payment_webhook_status, 'processed' | 'ignored'>,
    errorMessage: string | null,
    db: PrismaDb,
  ) {
    return db.payment_webhook_events.update({
      where: { id },
      data: { status, processed_at: new Date(), error_message: errorMessage },
    });
  }

  async recordFailure(data: WebhookEventInput, errorMessage: string) {
    const inserted = await this.prisma.payment_webhook_events.createMany({
      data: [{ ...data, status: 'failed', error_message: errorMessage }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return;
    await this.prisma.payment_webhook_events.updateMany({
      where: {
        provider_code: data.provider_code,
        provider_event_id: data.provider_event_id,
        status: { in: ['received', 'failed'] },
      },
      data: { status: 'failed', error_message: errorMessage },
    });
  }

  private uniqueKey(data: WebhookEventInput) {
    return {
      provider_code_provider_event_id: {
        provider_code: data.provider_code,
        provider_event_id: data.provider_event_id,
      },
    };
  }
}
