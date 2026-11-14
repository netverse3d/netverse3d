export const PAYMENT_EVENT_TYPES = [
  'payment.requires_action',
  'payment.processing',
  'payment.succeeded',
  'payment.failed',
  'payment.canceled',
  'payment.expired',
  'payment.refunded',
  'payment.partially_refunded',
  'payment.extra_capture',
  'payment.refund.processing',
  'payment.refund.failed',
] as const;

export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

export const MERCHANT_BILLING_EVENT_TYPES: readonly PaymentEventType[] = [
  'payment.succeeded',
  'payment.failed',
  'payment.canceled',
  'payment.expired',
  'payment.refunded',
  'payment.partially_refunded',
  'payment.extra_capture',
];

export function isPaymentEventType(value: unknown): value is PaymentEventType {
  return typeof value === 'string' && (PAYMENT_EVENT_TYPES as readonly string[]).includes(value);
}
