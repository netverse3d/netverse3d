import { z } from 'zod';
import { DELIVERY_CHANNELS } from '../../notifications/domain/channels';
import {
  EVENT_TYPE_PATTERN,
  LOCALE_PATTERN,
  MAX_DEVICE_TOKEN_LENGTH,
  MAX_DEVICE_TOKENS,
  MAX_EMAIL_LENGTH,
  MAX_EVENT_TYPE_LENGTH,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_LOCALE_LENGTH,
  MAX_SUBJECT_ID_LENGTH,
} from '../../notifications/domain/limits';
import { InvalidEventError } from '@netverse/nest-kit';

const MAX_TENANT_ID_LENGTH = 128;

const inboundEventSchema = z.object({
  id: z.string().min(1).max(MAX_IDEMPOTENCY_KEY_LENGTH),
  tenantId: z.string().min(1).max(MAX_TENANT_ID_LENGTH),
  eventType: z.string().max(MAX_EVENT_TYPE_LENGTH).regex(EVENT_TYPE_PATTERN),
  locale: z.string().max(MAX_LOCALE_LENGTH).regex(LOCALE_PATTERN).optional(),
  channels: z.array(z.enum(DELIVERY_CHANNELS)).min(1).optional(),
  recipient: z.object({
    subject: z.string().min(1).max(MAX_SUBJECT_ID_LENGTH).optional(),
    email: z.email().max(MAX_EMAIL_LENGTH).optional(),
    deviceTokens: z
      .array(z.string().min(1).max(MAX_DEVICE_TOKEN_LENGTH))
      .max(MAX_DEVICE_TOKENS)
      .optional(),
  }),
  variables: z.record(z.string(), z.unknown()).default({}),
});

export type InboundEvent = z.infer<typeof inboundEventSchema>;

export function parseInboundEvent(payload: Buffer): InboundEvent {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload.toString('utf8'));
  } catch {
    throw new InvalidEventError('event body is not valid JSON');
  }
  const parsed = inboundEventSchema.safeParse(decoded);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new InvalidEventError(`event failed validation on: ${fields}`);
  }
  return parsed.data;
}
