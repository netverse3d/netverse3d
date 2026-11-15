import { HttpStatus } from '@nestjs/common';
import { ErrorCodeDefinition } from '@netverse/nest-kit';

const UNPROCESSABLE = HttpStatus.UNPROCESSABLE_ENTITY;

export const PaymentErrorCode = {
  API_KEY_MISSING: {
    code: 'PAYMENT.API_KEY_MISSING',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Missing x-api-key',
  },
  API_KEY_MALFORMED: {
    code: 'PAYMENT.API_KEY_MALFORMED',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Malformed API key',
  },
  API_KEY_INVALID: {
    code: 'PAYMENT.API_KEY_INVALID',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'API key is invalid or inactive',
  },
  API_KEY_EXPIRED: {
    code: 'PAYMENT.API_KEY_EXPIRED',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'API key has expired',
  },
  AMOUNT_NOT_POSITIVE: {
    code: 'PAYMENT.AMOUNT_NOT_POSITIVE',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Amount must be greater than zero',
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    code: 'PAYMENT.IDEMPOTENCY_KEY_REQUIRED',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Header idempotency-key is required',
  },
  IDEMPOTENCY_CONFLICT: {
    code: 'PAYMENT.IDEMPOTENCY_CONFLICT',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Idempotency conflict: request payload changed',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    code: 'PAYMENT.IDEMPOTENCY_IN_PROGRESS',
    httpStatus: HttpStatus.CONFLICT,
    message: 'A request with this idempotency key is still in progress',
  },
  IDEMPOTENCY_RECORD_MISSING: {
    code: 'PAYMENT.IDEMPOTENCY_RECORD_MISSING',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Idempotency record vanished after insert',
  },
  OUTBOX_EVENT_NOT_FOUND: {
    code: 'PAYMENT.OUTBOX_EVENT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Outbox event not found',
  },
  DEAD_DELIVERY_NOT_FOUND: {
    code: 'PAYMENT.DEAD_DELIVERY_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Dead delivery not found',
  },
  PAYMENT_INTENT_NOT_FOUND: {
    code: 'PAYMENT.PAYMENT_INTENT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Payment intent not found',
  },
  PAYMENT_INTENT_ALREADY_SUCCEEDED: {
    code: 'PAYMENT.PAYMENT_INTENT_ALREADY_SUCCEEDED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Payment intent already succeeded',
  },
  PAYMENT_INTENT_NOT_ATTEMPTABLE: {
    code: 'PAYMENT.PAYMENT_INTENT_NOT_ATTEMPTABLE',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Payment intent cannot take a new attempt',
  },
  MERCHANT_REFERENCE_CONFLICT: {
    code: 'PAYMENT.MERCHANT_REFERENCE_CONFLICT',
    httpStatus: HttpStatus.CONFLICT,
    message: 'merchantReference already used by a different payment intent',
  },
  PAYMENT_ATTEMPT_NOT_FOUND: {
    code: 'PAYMENT.PAYMENT_ATTEMPT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Payment attempt not found',
  },
  PROVIDER_ACCOUNT_MISSING: {
    code: 'PAYMENT.PROVIDER_ACCOUNT_MISSING',
    httpStatus: UNPROCESSABLE,
    message: 'Tenant has no active account for this provider',
  },
  PROVIDER_ACCOUNT_NOT_FOUND: {
    code: 'PAYMENT.PROVIDER_ACCOUNT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Provider account not found',
  },
  PROVIDER_ACCOUNT_INVALID: {
    code: 'PAYMENT.PROVIDER_ACCOUNT_INVALID',
    httpStatus: UNPROCESSABLE,
    message: 'Provider account configuration is invalid',
  },
  PROVIDER_ACCOUNT_EXISTS: {
    code: 'PAYMENT.PROVIDER_ACCOUNT_EXISTS',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Provider account already exists (account label or external account ref taken)',
  },
  CREDENTIALS_ENCRYPTION_UNAVAILABLE: {
    code: 'PAYMENT.CREDENTIALS_ENCRYPTION_UNAVAILABLE',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Provider credential encryption is not configured',
  },
  WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE: {
    code: 'PAYMENT.WEBHOOK_SECRET_ENCRYPTION_UNAVAILABLE',
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Tenant webhook secret encryption is not configured',
  },
  PROVIDER_NOT_SUPPORTED: {
    code: 'PAYMENT.PROVIDER_NOT_SUPPORTED',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Provider is not supported',
  },
  PROVIDER_DISABLED: {
    code: 'PAYMENT.PROVIDER_DISABLED',
    httpStatus: UNPROCESSABLE,
    message: 'Payment gateway is currently closed',
  },
  GATEWAY_TIMEOUT: {
    code: 'PAYMENT.GATEWAY_TIMEOUT',
    httpStatus: HttpStatus.GATEWAY_TIMEOUT,
    message: 'Payment gateway did not respond in time',
  },
  GATEWAY_ERROR: {
    code: 'PAYMENT.GATEWAY_ERROR',
    httpStatus: HttpStatus.BAD_GATEWAY,
    message: 'Payment gateway is experiencing a problem',
  },
  CURRENCY_NOT_SUPPORTED: {
    code: 'PAYMENT.CURRENCY_NOT_SUPPORTED',
    httpStatus: UNPROCESSABLE,
    message: 'This provider only accepts VND',
  },
  RETURN_URL_REQUIRED: {
    code: 'PAYMENT.RETURN_URL_REQUIRED',
    httpStatus: UNPROCESSABLE,
    message: 'A return URL is required for this provider',
  },
  PAYER_IP_REQUIRED: {
    code: 'PAYMENT.PAYER_IP_REQUIRED',
    httpStatus: UNPROCESSABLE,
    message: 'The payer IP address is required for this provider',
  },
  AMOUNT_OUT_OF_RANGE: {
    code: 'PAYMENT.AMOUNT_OUT_OF_RANGE',
    httpStatus: UNPROCESSABLE,
    message: 'Order number or amount exceeds the provider limit',
  },
  PROVIDER_ORDER_CODE_TAKEN: {
    code: 'PAYMENT.PROVIDER_ORDER_CODE_TAKEN',
    httpStatus: HttpStatus.CONFLICT,
    message: 'The provider reports this order code is already used on this channel',
  },
  WEBHOOK_METHOD_NOT_ALLOWED: {
    code: 'PAYMENT.WEBHOOK_METHOD_NOT_ALLOWED',
    httpStatus: HttpStatus.METHOD_NOT_ALLOWED,
    message: 'Provider does not accept this webhook method',
  },
  WEBHOOK_SIGNATURE_INVALID: {
    code: 'PAYMENT.WEBHOOK_SIGNATURE_INVALID',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Invalid webhook signature',
  },
  WEBHOOK_SECRET_MISSING: {
    code: 'PAYMENT.WEBHOOK_SECRET_MISSING',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Webhook cannot be verified: provider account has no webhook secret',
  },
  WEBHOOK_ACCOUNT_UNKNOWN: {
    code: 'PAYMENT.WEBHOOK_ACCOUNT_UNKNOWN',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Webhook account is not registered',
  },
  WEBHOOK_ACCOUNT_MISMATCH: {
    code: 'PAYMENT.WEBHOOK_ACCOUNT_MISMATCH',
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'Webhook signer does not own the referenced payment',
  },
  WEBHOOK_PAYLOAD_INVALID: {
    code: 'PAYMENT.WEBHOOK_PAYLOAD_INVALID',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Webhook payload is invalid',
  },
  PROVIDER_EVENT_STATUS_MISSING: {
    code: 'PAYMENT.PROVIDER_EVENT_STATUS_MISSING',
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Provider event has no status to apply',
  },
  PROVIDER_EVENT_TARGET_NOT_FOUND: {
    code: 'PAYMENT.PROVIDER_EVENT_TARGET_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Payment intent could not be resolved from provider event',
  },
  TRANSFER_NOT_CONFIRMABLE: {
    code: 'PAYMENT.TRANSFER_NOT_CONFIRMABLE',
    httpStatus: HttpStatus.CONFLICT,
    message: 'This transfer cannot be confirmed manually',
  },
  TRANSFER_AMOUNT_MISMATCH: {
    code: 'PAYMENT.TRANSFER_AMOUNT_MISMATCH',
    httpStatus: UNPROCESSABLE,
    message: 'Amount or currency does not match the payment',
  },
  BANK_REFERENCE_USED: {
    code: 'PAYMENT.BANK_REFERENCE_USED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'This bank reference was already recorded for another payment',
  },
  REFUND_NOT_FOUND: {
    code: 'PAYMENT.REFUND_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Refund not found',
  },
  PAYMENT_INTENT_NOT_REFUNDABLE: {
    code: 'PAYMENT.PAYMENT_INTENT_NOT_REFUNDABLE',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Payment intent cannot be refunded',
  },
  PAYMENT_INTENT_NO_CAPTURED_ATTEMPT: {
    code: 'PAYMENT.PAYMENT_INTENT_NO_CAPTURED_ATTEMPT',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Payment intent has no captured attempt to refund',
  },
  PAYMENT_INTENT_FULLY_REFUNDED: {
    code: 'PAYMENT.PAYMENT_INTENT_FULLY_REFUNDED',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Payment intent is already fully refunded or has pending refunds',
  },
  REFUND_NOT_SUPPORTED: {
    code: 'PAYMENT.REFUND_NOT_SUPPORTED',
    httpStatus: UNPROCESSABLE,
    message: 'Provider does not support refunds',
  },
  PARTIAL_REFUND_NOT_SUPPORTED: {
    code: 'PAYMENT.PARTIAL_REFUND_NOT_SUPPORTED',
    httpStatus: UNPROCESSABLE,
    message: 'Provider does not support partial refunds',
  },
  REFUND_AMOUNT_INVALID: {
    code: 'PAYMENT.REFUND_AMOUNT_INVALID',
    httpStatus: UNPROCESSABLE,
    message: 'amountMinor must be greater than zero',
  },
  REFUND_AMOUNT_EXCEEDS_REFUNDABLE: {
    code: 'PAYMENT.REFUND_AMOUNT_EXCEEDS_REFUNDABLE',
    httpStatus: UNPROCESSABLE,
    message: 'Refund amount exceeds the refundable amount',
  },
  TENANT_NOT_FOUND: {
    code: 'PAYMENT.TENANT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Tenant not found',
  },
  TENANT_CODE_TAKEN: {
    code: 'PAYMENT.TENANT_CODE_TAKEN',
    httpStatus: HttpStatus.CONFLICT,
    message: 'Tenant code already exists',
  },
  WEBHOOK_ENDPOINT_NOT_FOUND: {
    code: 'PAYMENT.WEBHOOK_ENDPOINT_NOT_FOUND',
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Webhook endpoint not found',
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
