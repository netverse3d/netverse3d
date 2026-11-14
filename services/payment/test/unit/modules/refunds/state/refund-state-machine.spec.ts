import { refund_status } from '@app/infrastructure/prisma/client';
import {
  decideRefundTransition,
  isTerminalRefundStatus,
} from '@app/modules/refunds/state/refund-state-machine';

const ALL = Object.values(refund_status);

describe('máy trạng thái refund', () => {
  it.each([
    ['pending', 'processing'],
    ['pending', 'succeeded'],
    ['pending', 'failed'],
    ['processing', 'succeeded'],
    ['processing', 'failed'],
  ] as const)('%s -> %s được phép', (from, to) => {
    expect(decideRefundTransition(from, to)).toBe('apply');
  });

  it.each(['succeeded', 'failed', 'canceled'] as const)('%s là trạng thái cuối', (from) => {
    expect(isTerminalRefundStatus(from)).toBe(true);
    for (const to of ALL)
      expect(decideRefundTransition(from, to)).toBe(from === to ? 'noop' : 'reject');
  });

  it('processing không lùi về pending, không bị huỷ', () => {
    expect(decideRefundTransition('processing', 'pending')).toBe('reject');
    expect(decideRefundTransition('processing', 'canceled')).toBe('reject');
  });
});
