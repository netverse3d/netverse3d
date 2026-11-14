import { payment_attempt_status } from '@app/infrastructure/prisma/client';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import {
  ProviderAccountContext,
  ProviderWebhookAck,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
} from '../contracts/payment-provider.contract';
import {
  VNPAY_CUSTOMER_CANCELED,
  VNPAY_DEFAULT_FAILURE_MESSAGE,
  VNPAY_FAILURE_MESSAGES,
  VNPAY_IPN_ACK,
  VNPAY_SUCCESS,
} from './vnpay.constants';

const AMOUNT_REASONS = new Set(['AMOUNT_MISMATCH', 'AMOUNT_MISSING', 'CURRENCY_MISMATCH']);
const CONFIRMED_REASONS = new Set([
  'NO_STATE_CHANGE',
  'STALE_ATTEMPT_TRANSITION',
  'STALE_INTENT_TRANSITION',
]);

export function vnpayParams(request: ProviderWebhookRequest): Record<string, string> {
  const result: Record<string, string> = {};
  if (request.rawQuery) {
    for (const [key, value] of new URLSearchParams(request.rawQuery)) {
      if (key.startsWith('vnp_') && !(key in result)) result[key] = value;
    }
    return result;
  }
  for (const [key, value] of Object.entries(request.query)) {
    if (!key.startsWith('vnp_')) continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') result[key] = first;
  }
  return result;
}

export function vnpaySecrets(account: ProviderAccountContext | null): string[] {
  const credentials = account?.credentials ?? {};
  return [credentials.hashSecret, credentials.previousHashSecret].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

export function vnpayAmountToMinor(raw: string | undefined): bigint {
  if (!raw || !/^\d+$/.test(raw))
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message: 'vnp_Amount must be a non-negative integer',
      details: { vnp_Amount: raw ?? null },
    });
  const value = BigInt(raw);
  if (value % 100n !== 0n)
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message: 'vnp_Amount must be a multiple of 100 (VND x 100)',
      details: { vnp_Amount: raw },
    });
  return value / 100n;
}

export function vnpayFailureMessage(code: string) {
  return VNPAY_FAILURE_MESSAGES[code] ?? VNPAY_DEFAULT_FAILURE_MESSAGE;
}

export function vnpayIpnStatus(
  responseCode: string,
  transactionStatus: string,
): payment_attempt_status {
  if (responseCode === VNPAY_SUCCESS && transactionStatus === VNPAY_SUCCESS) return 'succeeded';
  if (responseCode === VNPAY_CUSTOMER_CANCELED) return 'canceled';
  return 'failed';
}

export function vnpayTransactionNo(raw: string | undefined): string | null {
  return raw && raw !== '0' ? raw : null;
}

export function vnpayAck(outcome: ProviderWebhookOutcome): ProviderWebhookAck {
  return { httpStatus: 200, body: { ...ackBody(outcome) } };
}

function ackBody(outcome: ProviderWebhookOutcome) {
  switch (outcome.kind) {
    case 'processed':
    case 'skipped':
      return VNPAY_IPN_ACK.success;
    case 'duplicate':
      if (outcome.previousStatus === 'processed') return VNPAY_IPN_ACK.alreadyConfirmed;
      return reasonAck(outcome.previousReason);
    case 'ignored':
      return reasonAck(outcome.reason);
    case 'rejected':
      if (outcome.statusCode === 401) return VNPAY_IPN_ACK.invalidSignature;
      if (outcome.statusCode === 404) return VNPAY_IPN_ACK.orderNotFound;
      return VNPAY_IPN_ACK.unknownError;
  }
}

function reasonAck(reason: string | null) {
  if (reason === 'TARGET_NOT_FOUND') return VNPAY_IPN_ACK.orderNotFound;
  if (reason && AMOUNT_REASONS.has(reason)) return VNPAY_IPN_ACK.invalidAmount;
  if (reason && CONFIRMED_REASONS.has(reason)) return VNPAY_IPN_ACK.alreadyConfirmed;
  if (reason === 'NO_STATUS') return VNPAY_IPN_ACK.success;
  return VNPAY_IPN_ACK.unknownError;
}
