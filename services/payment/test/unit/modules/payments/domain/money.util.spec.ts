import { AppException } from '@netverse/nest-kit';
import {
  ensurePositiveMinorAmount,
  sumMinorAmounts,
} from '@app/modules/payments/domain/money.util';

describe('sumMinorAmounts', () => {
  it('cộng đúng BigInt minor-unit (không float)', () => {
    expect(sumMinorAmounts(150000n, 25000n, 5000n)).toBe(180000n);
  });

  it('không đối số thì trả 0n', () => {
    expect(sumMinorAmounts()).toBe(0n);
  });

  it('giữ chính xác với số lớn vượt Number.MAX_SAFE_INTEGER', () => {
    const huge = 9007199254740993n;
    expect(sumMinorAmounts(huge, 1n)).toBe(9007199254740994n);
  });
});

describe('ensurePositiveMinorAmount', () => {
  it('cho qua khi amount > 0', () => {
    expect(() => ensurePositiveMinorAmount(1n)).not.toThrow();
  });

  it('ném AppException 400 khi amount = 0', () => {
    expect.assertions(2);
    try {
      ensurePositiveMinorAmount(0n);
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(400);
    }
  });

  it('ném lỗi kèm tên field khi amount âm', () => {
    expect(() => ensurePositiveMinorAmount(-500n, 'amount_minor')).toThrow(
      'amount_minor must be greater than zero',
    );
  });
});
