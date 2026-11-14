import { Prisma } from '@app/infrastructure/prisma/client';

export type {
  idempotency_records,
  payment_attempt_status,
  payment_attempts,
  payment_intent_status,
  payment_intents,
  payment_outbox_events,
  provider_accounts,
  refunds,
  tenant_webhook_endpoints,
} from '@app/infrastructure/prisma/client';

export type InputJson = Prisma.InputJsonValue;
export type JsonValue = Prisma.JsonValue;
export type WebhookEventCreateInput = Prisma.payment_webhook_eventsUncheckedCreateInput;
export type PaymentIntentCreateInput = Prisma.payment_intentsCreateInput;
export type ProviderAccountCreateInput = Prisma.provider_accountsUncheckedCreateInput;

export const JSON_NULL = Prisma.JsonNull;

const UNIQUE_VIOLATION = 'P2002';

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}
