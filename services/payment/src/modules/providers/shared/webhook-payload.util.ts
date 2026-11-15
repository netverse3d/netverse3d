import { payment_attempt_status } from '@app/infrastructure/prisma/client';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { isPaymentAttemptStatus } from '@app/modules/payments/state/payment-state-machine';
import {
  ProviderWebhookInspection,
  ProviderWebhookRequest,
} from '../contracts/payment-provider.contract';

export function parseOptionalAttemptStatus(value: unknown): payment_attempt_status | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isPaymentAttemptStatus(value)) {
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message: 'Webhook status is not a valid payment attempt status',
      details: { status: value },
    });
  }
  return value;
}

export function parseOptionalMinorAmount(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  const text =
    typeof value === 'bigint'
      ? value.toString()
      : typeof value === 'number' || typeof value === 'string'
        ? String(value)
        : '';
  if (!/^\d+$/.test(text)) {
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message: 'Webhook amountMinor must be a non-negative integer (minor unit)',
      details: { amountMinor: value },
    });
  }
  return BigInt(text);
}

export function parseOptionalCurrency(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
    throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
      message: 'Webhook currency must be a 3-letter ISO code',
      details: { currency: value },
    });
  }
  return value.toUpperCase();
}

export function optionalString(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : String(value);
}

export function webhookBodyObject(request: ProviderWebhookRequest): Record<string, unknown> {
  const body = request.body;
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function inspectJsonWebhookBody(request: ProviderWebhookRequest): ProviderWebhookInspection {
  const body = webhookBodyObject(request);
  return {
    accountRef: null,
    merchantReference: optionalString(body.providerOrderId),
    providerPaymentId: optionalString(body.providerPaymentId),
    paymentIntentPublicId: optionalString(body.paymentIntentPublicId),
  };
}
