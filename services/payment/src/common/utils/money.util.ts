import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';

export function sumMinorAmounts(...values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}

export function ensurePositiveMinorAmount(value: bigint, field = 'amount') {
  if (value <= 0n)
    throw new AppException(PaymentErrorCode.AMOUNT_NOT_POSITIVE, {
      message: `${field} must be greater than zero`,
    });
}
