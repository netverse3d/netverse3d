import { refund_status } from '@app/infrastructure/prisma/client';
import { TransitionDecision } from '@app/modules/payments/state/payment-state-machine';

const REFUND_TRANSITIONS: Record<refund_status, readonly refund_status[]> = {
  pending: ['processing', 'succeeded', 'failed', 'canceled'],
  processing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  canceled: [],
};

export const RESERVING_REFUND_STATUSES: readonly refund_status[] = [
  'pending',
  'processing',
  'succeeded',
];

export function decideRefundTransition(from: refund_status, to: refund_status): TransitionDecision {
  if (from === to) return 'noop';
  return REFUND_TRANSITIONS[from].includes(to) ? 'apply' : 'reject';
}

export function isTerminalRefundStatus(status: refund_status) {
  return REFUND_TRANSITIONS[status].length === 0;
}
