import { payment_attempt_status, payment_intent_status } from '@app/infrastructure/prisma/client';
import {
  decideAttemptTransition,
  decideIntentTransition,
  isPaymentAttemptStatus,
  isTerminalAttemptStatus,
} from '@app/modules/payments/state/payment-state-machine';

const ATTEMPT_STATUSES = Object.values(payment_attempt_status);
const INTENT_STATUSES = Object.values(payment_intent_status);

describe('máy trạng thái payment — attempt', () => {
  it.each([
    ['pending', 'requires_action'],
    ['pending', 'succeeded'],
    ['requires_action', 'processing'],
    ['requires_action', 'succeeded'],
    ['requires_action', 'failed'],
    ['processing', 'succeeded'],
    ['processing', 'expired'],
  ] as const)('%s -> %s được phép', (from, to) => {
    expect(decideAttemptTransition(from, to)).toBe('apply');
  });

  it.each(['succeeded', 'failed', 'canceled', 'expired'] as const)(
    'trạng thái cuối %s không đổi sang trạng thái khác',
    (from) => {
      for (const to of ATTEMPT_STATUSES) {
        expect(decideAttemptTransition(from, to)).toBe(from === to ? 'noop' : 'reject');
      }
    },
  );

  it('processing không lùi về pending/requires_action', () => {
    expect(decideAttemptTransition('processing', 'pending')).toBe('reject');
    expect(decideAttemptTransition('processing', 'requires_action')).toBe('reject');
    expect(decideAttemptTransition('requires_action', 'pending')).toBe('reject');
  });

  it('trùng trạng thái là noop', () => {
    for (const status of ATTEMPT_STATUSES)
      expect(decideAttemptTransition(status, status)).toBe('noop');
  });

  it('isTerminalAttemptStatus', () => {
    expect(ATTEMPT_STATUSES.filter(isTerminalAttemptStatus).sort()).toEqual([
      'canceled',
      'expired',
      'failed',
      'succeeded',
    ]);
  });

  it('isPaymentAttemptStatus chặn giá trị ngoài enum', () => {
    expect(isPaymentAttemptStatus('succeeded')).toBe(true);
    expect(isPaymentAttemptStatus('refunded')).toBe(false);
    expect(isPaymentAttemptStatus('SUCCEEDED')).toBe(false);
    expect(isPaymentAttemptStatus('toString')).toBe(false);
    expect(isPaymentAttemptStatus(undefined)).toBe(false);
  });
});

describe('máy trạng thái payment — intent', () => {
  it.each(['processing', 'failed', 'canceled', 'expired', 'pending', 'requires_action'] as const)(
    'succeeded KHÔNG bị hạ xuống %s',
    (to) => {
      expect(decideIntentTransition('succeeded', to)).toBe('reject');
    },
  );

  it('succeeded chỉ đi tiếp sang refund', () => {
    expect(decideIntentTransition('succeeded', 'partially_refunded')).toBe('apply');
    expect(decideIntentTransition('succeeded', 'refunded')).toBe('apply');
  });

  it('refunded là trạng thái cuối', () => {
    for (const to of INTENT_STATUSES) {
      expect(decideIntentTransition('refunded', to)).toBe(to === 'refunded' ? 'noop' : 'reject');
    }
  });

  it('partially_refunded chỉ đi tới refunded', () => {
    for (const to of INTENT_STATUSES) {
      const expected =
        to === 'partially_refunded' ? 'noop' : to === 'refunded' ? 'apply' : 'reject';
      expect(decideIntentTransition('partially_refunded', to)).toBe(expected);
    }
  });

  it('failed cho attempt mới thử lại, kể cả thành công', () => {
    expect(decideIntentTransition('failed', 'requires_action')).toBe('apply');
    expect(decideIntentTransition('failed', 'succeeded')).toBe('apply');
    expect(decideIntentTransition('failed', 'pending')).toBe('reject');
  });

  it('canceled/expired chỉ nhận late capture succeeded', () => {
    for (const from of ['canceled', 'expired'] as const) {
      for (const to of INTENT_STATUSES) {
        const expected = to === from ? 'noop' : to === 'succeeded' ? 'apply' : 'reject';
        expect(decideIntentTransition(from, to)).toBe(expected);
      }
    }
  });

  it('webhook payment không thể đưa intent sang refund từ trạng thái chưa trả tiền', () => {
    for (const from of ['pending', 'requires_action', 'processing', 'failed'] as const) {
      expect(decideIntentTransition(from, 'refunded')).toBe('reject');
      expect(decideIntentTransition(from, 'partially_refunded')).toBe('reject');
    }
  });
});
