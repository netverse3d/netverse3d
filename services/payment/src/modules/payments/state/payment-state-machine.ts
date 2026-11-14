import { payment_attempt_status, payment_intent_status } from '@app/infrastructure/prisma/client';

const ATTEMPT_TRANSITIONS: Record<payment_attempt_status, readonly payment_attempt_status[]> = {
  pending: ['requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'expired'],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled', 'expired'],
  processing: ['succeeded', 'failed', 'canceled', 'expired'],
  succeeded: [],
  failed: [],
  canceled: [],
  expired: [],
};

const INTENT_TRANSITIONS: Record<payment_intent_status, readonly payment_intent_status[]> = {
  pending: ['requires_action', 'processing', 'succeeded', 'failed', 'canceled', 'expired'],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled', 'expired'],
  processing: ['succeeded', 'failed', 'canceled', 'expired'],
  failed: ['requires_action', 'processing', 'succeeded', 'canceled', 'expired'],
  canceled: ['succeeded'],
  expired: ['succeeded'],
  succeeded: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  refunded: [],
};

const TERMINAL_ATTEMPT_STATUSES: readonly payment_attempt_status[] = [
  'succeeded',
  'failed',
  'canceled',
  'expired',
];

export type TransitionDecision = 'apply' | 'noop' | 'reject';

export function decideAttemptTransition(
  from: payment_attempt_status,
  to: payment_attempt_status,
): TransitionDecision {
  if (from === to) return 'noop';
  return ATTEMPT_TRANSITIONS[from].includes(to) ? 'apply' : 'reject';
}

export function decideIntentTransition(
  from: payment_intent_status,
  to: payment_intent_status,
): TransitionDecision {
  if (from === to) return 'noop';
  return INTENT_TRANSITIONS[from].includes(to) ? 'apply' : 'reject';
}

export function isTerminalAttemptStatus(status: payment_attempt_status) {
  return TERMINAL_ATTEMPT_STATUSES.includes(status);
}

export function intentStatusForAttemptStatus(
  status: payment_attempt_status,
): payment_intent_status {
  return status;
}

export function isPaymentAttemptStatus(value: unknown): value is payment_attempt_status {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(ATTEMPT_TRANSITIONS, value)
  );
}

const LATE_CAPTURE_ATTEMPT_STATUSES: readonly payment_attempt_status[] = [
  'failed',
  'canceled',
  'expired',
];
const CAPTURED_INTENT_STATUSES: readonly payment_intent_status[] = [
  'succeeded',
  'partially_refunded',
  'refunded',
];

export function isLateCaptureCandidate(from: payment_attempt_status, to: payment_attempt_status) {
  return to === 'succeeded' && LATE_CAPTURE_ATTEMPT_STATUSES.includes(from);
}

export function isCapturedIntentStatus(status: payment_intent_status) {
  return CAPTURED_INTENT_STATUSES.includes(status);
}
