import { payment_attempt_status, payment_method_type } from '@app/infrastructure/prisma/client';
import {
  PaymentProvider,
  ProviderAccountContext,
  ProviderAccountValidationInput,
  ProviderCancelCheckoutInput,
  ProviderCapabilities,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderPaymentQueryInput,
  ProviderPaymentState,
  ProviderRefundInput,
  ProviderRefundQueryInput,
  ProviderRefundState,
  ProviderWebhookAck,
  ProviderWebhookInspection,
  ProviderWebhookNormalization,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
  ProviderWebhookSignatureCheck,
} from '@app/modules/providers/contracts/payment-provider.contract';
import { verifyHmacWebhookSignature } from '@app/modules/providers/shared/hmac-webhook-signature.util';
import {
  inspectJsonWebhookBody,
  optionalString,
  parseOptionalAttemptStatus,
  parseOptionalCurrency,
  parseOptionalMinorAmount,
  webhookBodyObject,
} from '@app/modules/providers/shared/webhook-payload.util';

export const FAKE_PROVIDER_CODE = 'fake';

export interface FakeProviderOptions {
  code?: string;
  capabilities?: Partial<ProviderCapabilities>;
  checkout?: (input: ProviderCheckoutInput) => Promise<ProviderCheckoutResult>;
  cancelCheckout?: (input: ProviderCancelCheckoutInput) => Promise<void>;
  queryPayment?: (input: ProviderPaymentQueryInput) => Promise<ProviderPaymentState>;
  createRefund?: (input: ProviderRefundInput) => Promise<ProviderRefundState>;
  queryRefund?: (input: ProviderRefundQueryInput) => Promise<ProviderRefundState>;
  acknowledgeWebhook?: (outcome: ProviderWebhookOutcome) => ProviderWebhookAck;
  validateAccount?: (input: ProviderAccountValidationInput) => string[];
}

export const FAKE_CAPABILITIES: ProviderCapabilities = {
  checkout: true,
  checkoutFlow: 'redirect',
  queryPayment: false,
  refund: false,
  partialRefund: false,
  recurring: false,
  tokenization: false,
  webhookReportsAmount: false,
  webhookMethods: ['POST'],
  plaintextCredentialsAllowed: true,
  requiresWebhookSecret: false,
  operatorConfirm: false,
  acceptsLateSuccess: true,
};

export class FakePaymentProvider implements PaymentProvider {
  code: string;
  cancelCheckout?: (input: ProviderCancelCheckoutInput) => Promise<void>;
  queryPayment?: (input: ProviderPaymentQueryInput) => Promise<ProviderPaymentState>;
  createRefund?: (input: ProviderRefundInput) => Promise<ProviderRefundState>;
  queryRefund?: (input: ProviderRefundQueryInput) => Promise<ProviderRefundState>;
  acknowledgeWebhook?: (outcome: ProviderWebhookOutcome) => ProviderWebhookAck;
  validateAccount?: (input: ProviderAccountValidationInput) => string[];
  private readonly caps: ProviderCapabilities;
  private readonly checkoutImpl?: (input: ProviderCheckoutInput) => Promise<ProviderCheckoutResult>;

  constructor(options: FakeProviderOptions = {}) {
    this.code = options.code ?? FAKE_PROVIDER_CODE;
    this.caps = {
      ...FAKE_CAPABILITIES,
      queryPayment: !!options.queryPayment,
      refund: !!options.createRefund,
      partialRefund: !!options.createRefund,
      ...options.capabilities,
    };
    this.checkoutImpl = options.checkout;
    if (options.cancelCheckout) this.cancelCheckout = options.cancelCheckout;
    if (options.queryPayment) this.queryPayment = options.queryPayment;
    if (options.createRefund) this.createRefund = options.createRefund;
    if (options.queryRefund) this.queryRefund = options.queryRefund;
    if (options.acknowledgeWebhook) this.acknowledgeWebhook = options.acknowledgeWebhook;
    if (options.validateAccount) this.validateAccount = options.validateAccount;
  }

  capabilities(): ProviderCapabilities {
    return this.caps;
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (this.checkoutImpl) return this.checkoutImpl(input);
    const url = `https://fake.test/pay/${input.providerOrderRef}`;
    return {
      providerPaymentId: `${this.code}_${input.publicId}`,
      providerOrderId: input.providerOrderRef,
      methodType: payment_method_type.manual,
      status: payment_attempt_status.requires_action,
      checkoutUrl: url,
      nextAction: { type: 'redirect', url },
      providerData: { orderNumber: input.orderNumber.toString() },
      responsePayload: { provider: this.code },
    };
  }

  inspectWebhook(request: ProviderWebhookRequest): ProviderWebhookInspection {
    return inspectJsonWebhookBody(request);
  }

  verifyWebhook(
    request: ProviderWebhookRequest,
    providerAccount: ProviderAccountContext | null,
  ): ProviderWebhookSignatureCheck {
    return verifyHmacWebhookSignature(request.rawBody, request.headers, providerAccount);
  }

  async normalizeWebhook(request: ProviderWebhookRequest): Promise<ProviderWebhookNormalization> {
    const body = webhookBodyObject(request);
    return {
      providerEventId: String(body.eventId ?? `${this.code}_${Date.now()}`),
      eventType: String(body.eventType ?? `${this.code}.event`),
      providerPaymentId: optionalString(body.providerPaymentId),
      paymentIntentPublicId: optionalString(body.paymentIntentPublicId),
      providerOrderId: optionalString(body.providerOrderId),
      status: parseOptionalAttemptStatus(body.status),
      amountMinor: parseOptionalMinorAmount(body.amountMinor),
      currency: parseOptionalCurrency(body.currency),
      failureCode: optionalString(body.failureCode),
      failureMessage: optionalString(body.failureMessage),
      payload: body,
    };
  }
}
