import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';

export function parseProviderAmount(value: unknown, message: string, field: string): bigint {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (!/^\d+$/.test(text)) {
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message,
      details: { [field]: value ?? null },
    });
  }
  return BigInt(text);
}
