import { payment_attempt_status, payment_attempts } from '@app/infrastructure/prisma/client';
import { normalizeForJson } from '@app/common/utils/serialization.util';
import { ProviderNextAction } from '@app/modules/providers/contracts/payment-provider.contract';

export const OPEN_ATTEMPT_STATUSES: readonly payment_attempt_status[] = [
  'pending',
  'requires_action',
  'processing',
];

export type StoredNextAction = Record<string, unknown> & { type: 'redirect' | 'qr' };

export function isOpenAttemptStatus(status: payment_attempt_status) {
  return OPEN_ATTEMPT_STATUSES.includes(status);
}

export function serializeNextAction(
  nextAction: ProviderNextAction | null | undefined,
): StoredNextAction | null {
  if (!nextAction) return null;
  if (nextAction.type === 'redirect') return { type: 'redirect', url: nextAction.url };
  return normalizeForJson({
    ...nextAction,
    expiresAt: nextAction.expiresAt.toISOString(),
  }) as StoredNextAction;
}

export function requestPayloadObject(
  attempt: Pick<payment_attempts, 'request_payload'>,
): Record<string, unknown> {
  const payload = attempt.request_payload;
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export function attemptProviderData(
  attempt: Pick<payment_attempts, 'request_payload'>,
): Record<string, unknown> | null {
  const provider = requestPayloadObject(attempt).provider;
  return provider && typeof provider === 'object' && !Array.isArray(provider)
    ? (provider as Record<string, unknown>)
    : null;
}

export function attemptNextAction(
  attempt: Pick<payment_attempts, 'status' | 'checkout_url' | 'request_payload'>,
): StoredNextAction | null {
  if (!isOpenAttemptStatus(attempt.status)) return null;
  const stored = requestPayloadObject(attempt).nextAction;
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const type = (stored as Record<string, unknown>).type;
    if (type === 'redirect' || type === 'qr') return stored as StoredNextAction;
  }
  return attempt.checkout_url ? { type: 'redirect', url: attempt.checkout_url } : null;
}

export function toAttemptView<
  T extends Pick<payment_attempts, 'status' | 'checkout_url' | 'request_payload'>,
>(attempt: T) {
  return { ...attempt, next_action: attemptNextAction(attempt) };
}

type AttemptLike = Pick<payment_attempts, 'status' | 'checkout_url' | 'request_payload'>;

export function toIntentView<A extends AttemptLike, T extends { attempts: A[] }>(intent: T) {
  return { ...intent, attempts: intent.attempts.map((attempt) => toAttemptView(attempt)) };
}
