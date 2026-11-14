import {
  payment_attempt_status,
  payment_method_type,
  refund_status,
} from '@app/infrastructure/prisma/client';

export type ProviderWebhookMethod = 'GET' | 'POST';

export type ProviderCheckoutFlow = 'redirect' | 'qr';

export interface ProviderCapabilities {
  checkout: boolean;
  checkoutFlow: ProviderCheckoutFlow;
  queryPayment: boolean;
  refund: boolean;
  partialRefund: boolean;
  recurring: boolean;
  tokenization: boolean;
  webhookReportsAmount: boolean;
  webhookMethods: readonly ProviderWebhookMethod[];
  plaintextCredentialsAllowed: boolean;
  requiresWebhookSecret: boolean;
  operatorConfirm: boolean;
  acceptsLateSuccess: boolean;
}

export interface ProviderRequestContext {
  clientIp: string | null;
  userAgent?: string | null;
  locale?: string | null;
}

export interface ProviderAccountContext {
  id: string;
  tenant_id: string;
  externalAccountRef: string | null;
  credentials: Record<string, unknown>;
  config: Record<string, unknown> | null;
}

export interface ProviderCheckoutInput {
  tenantId: string;
  paymentIntentId: string;
  publicId: string;
  attemptId: string;
  orderNumber: bigint;
  createdAt: Date;
  amountMinor: bigint;
  currency: string;
  title: string;
  returnUrl?: string | null;
  cancelUrl?: string | null;
  providerAccountId?: string | null;
  providerAccount?: ProviderAccountContext | null;
  providerOrderRef: string;
  context: ProviderRequestContext;
}

export type ProviderNextAction =
  | { type: 'redirect'; url: string }
  | {
      type: 'qr';
      payload: string;
      bankBin: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      amountMinor: bigint;
      currency: string;
      reference: string;
      expiresAt: Date;
    };

export interface ProviderCheckoutResult {
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  methodType: payment_method_type;
  status: payment_attempt_status;
  checkoutUrl?: string | null;
  qrPayload?: string | null;
  expiresAt?: Date | null;
  nextAction?: ProviderNextAction | null;
  providerData?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
}

export interface ProviderWebhookRequest {
  method: string;
  query: Record<string, string | string[] | undefined>;
  rawQuery?: string;
  routeAccountRef?: string | null;
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
  body: unknown;
}

export interface ProviderWebhookInspection {
  accountRef?: string | null;
  merchantReference?: string | null;
  merchantReferenceCandidates?: readonly string[];
  providerPaymentId?: string | null;
  paymentIntentPublicId?: string | null;
}

export interface ProviderWebhookNormalization {
  providerEventId: string;
  eventType: string;
  providerPaymentId?: string | null;
  paymentIntentPublicId?: string | null;
  status?: payment_attempt_status | null;
  providerOrderId?: string | null;
  amountMinor?: bigint | null;
  currency?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  payload: Record<string, unknown>;
}

export type ProviderWebhookSignatureCheck =
  | { outcome: 'verified'; signature: string }
  | { outcome: 'no_secret' }
  | { outcome: 'invalid'; reason: string };

export interface ProviderPaymentQueryInput {
  tenantId: string;
  publicId: string;
  attemptId: string;
  orderNumber: bigint | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  providerData: Record<string, unknown> | null;
  amountMinor: bigint;
  currency: string;
  attemptCreatedAt: Date;
  attemptExpiresAt: Date | null;
  providerAccount: ProviderAccountContext | null;
  context: ProviderRequestContext;
}

export type ProviderPaymentState = ProviderWebhookNormalization;

export interface ProviderCancelCheckoutInput {
  tenantId: string;
  attemptId: string;
  orderNumber: bigint | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  providerData: Record<string, unknown> | null;
  providerAccount: ProviderAccountContext | null;
  reason: string;
}

export interface ProviderRefundInput {
  tenantId: string;
  refundPublicId: string;
  paymentIntentPublicId: string;
  attemptId: string | null;
  attemptCreatedAt: Date | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  providerData: Record<string, unknown> | null;
  amountMinor: bigint;
  currency: string;
  capturedAmountMinor: bigint;
  isFullRefund: boolean;
  reason: string | null;
  paidAt: Date | null;
  providerAccount: ProviderAccountContext | null;
  context: ProviderRequestContext;
}

export interface ProviderRefundState {
  status: Extract<refund_status, 'pending' | 'processing' | 'succeeded' | 'failed'>;
  providerRefundId?: string | null;
  failureReason?: string | null;
  payload: Record<string, unknown>;
}

export interface ProviderRefundQueryInput extends ProviderRefundInput {
  providerRefundId: string | null;
  refundCreatedAt: Date;
}

export type ProviderWebhookOutcome =
  | { kind: 'processed'; status: string }
  | { kind: 'duplicate'; previousStatus: string | null; previousReason: string | null }
  | { kind: 'skipped' }
  | { kind: 'ignored'; reason: string }
  | { kind: 'rejected'; statusCode: number; reason: string };

export interface ProviderWebhookAck {
  httpStatus: number;
  body: unknown;
}

export interface ProviderAccountValidationInput {
  externalAccountRef: string | null;
  credentials?: Record<string, unknown>;
  config: Record<string, unknown> | null;
}

export interface PaymentProvider {
  code: string;
  capabilities(): ProviderCapabilities;
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  cancelCheckout?(input: ProviderCancelCheckoutInput): Promise<void>;
  queryPayment?(input: ProviderPaymentQueryInput): Promise<ProviderPaymentState>;
  createRefund?(input: ProviderRefundInput): Promise<ProviderRefundState>;
  queryRefund?(input: ProviderRefundQueryInput): Promise<ProviderRefundState>;
  inspectWebhook(
    request: ProviderWebhookRequest,
    routeAccount?: ProviderAccountContext | null,
  ): ProviderWebhookInspection;
  verifyWebhook(
    request: ProviderWebhookRequest,
    providerAccount: ProviderAccountContext | null,
  ): ProviderWebhookSignatureCheck;
  normalizeWebhook(
    request: ProviderWebhookRequest,
    providerAccount?: ProviderAccountContext | null,
  ): Promise<ProviderWebhookNormalization>;
  acknowledgeWebhook?(outcome: ProviderWebhookOutcome): ProviderWebhookAck;
  validateAccount?(input: ProviderAccountValidationInput): string[];
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
export const PAYMENT_PROVIDERS_ENABLED = Symbol('PAYMENT_PROVIDERS_ENABLED');
export const PROVIDER_RUNTIME_CONFIG = Symbol('PROVIDER_RUNTIME_CONFIG');

export interface ProviderRuntimeConfig {
  httpTimeoutMs: number;
  expiryGraceMinutes: number;
  serverIp: string;
  vnpayPaymentUrl: string;
  vnpayApiUrl: string;
  payosApiBaseUrl: string;
  payosOrderCodeOffset: number;
}
