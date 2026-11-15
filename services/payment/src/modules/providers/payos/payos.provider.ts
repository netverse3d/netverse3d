import { Inject, Injectable } from '@nestjs/common';
import { payment_attempt_status, payment_method_type } from '@app/infrastructure/prisma/client';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { parseProviderAmount } from '../shared/parse-provider-amount.util';
import { providerWebhookAcknowledgement } from '../shared/provider-webhook-ack.util';
import {
  PaymentProvider,
  PROVIDER_RUNTIME_CONFIG,
  ProviderAccountContext,
  ProviderAccountValidationInput,
  ProviderCancelCheckoutInput,
  ProviderCapabilities,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderPaymentQueryInput,
  ProviderPaymentState,
  ProviderRuntimeConfig,
  ProviderWebhookAck,
  ProviderWebhookInspection,
  ProviderWebhookNormalization,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
  ProviderWebhookSignatureCheck,
} from '../contracts/payment-provider.contract';
import { asRecord, stringField } from '../shared/provider-http.client';
import { optionalString, webhookBodyObject } from '../shared/webhook-payload.util';
import { PayosApiClient, PayosApiError, PayosCredentials } from './payos-api.client';
import { verifyPayosDataSignature } from './payos-signature.util';
import { vnBankName } from '../shared/vn-bank-bins';

export const PAYOS_PROVIDER_CODE = 'payos';
const PAYOS_CURRENCY = 'VND';
const PAYOS_DEFAULT_EXPIRE_MINUTES = 15;
const PAYOS_DESCRIPTION_MAX = 9;
const PAYOS_ORDER_EXISTS = '231';

@Injectable()
export class PayosProvider implements PaymentProvider {
  code = PAYOS_PROVIDER_CODE;
  private readonly api: PayosApiClient;
  private readonly orderCodeOffset: bigint;

  constructor(@Inject(PROVIDER_RUNTIME_CONFIG) config: ProviderRuntimeConfig) {
    this.api = new PayosApiClient(config.payosApiBaseUrl, config.httpTimeoutMs);
    this.orderCodeOffset = BigInt(config.payosOrderCodeOffset);
  }

  capabilities(): ProviderCapabilities {
    return {
      checkout: true,
      checkoutFlow: 'qr',
      queryPayment: true,
      refund: false,
      partialRefund: false,
      recurring: false,
      tokenization: false,
      webhookReportsAmount: true,
      webhookMethods: ['POST'],
      plaintextCredentialsAllowed: false,
      requiresWebhookSecret: true,
      operatorConfirm: false,
      acceptsLateSuccess: true,
    };
  }

  validateAccount(input: ProviderAccountValidationInput): string[] {
    const problems: string[] = [];
    if (!input.externalAccountRef) problems.push('externalAccountRef must be the payOS clientId');
    if (input.credentials) {
      for (const key of ['clientId', 'apiKey', 'checksumKey'] as const) {
        if (
          typeof input.credentials[key] !== 'string' ||
          !(input.credentials[key] as string).trim()
        )
          problems.push(`credentials.${key} is required`);
      }
      if (input.externalAccountRef && input.credentials.clientId !== input.externalAccountRef) {
        problems.push('externalAccountRef must match credentials.clientId');
      }
    }
    const expireMinutes = input.config?.expireMinutes;
    if (
      expireMinutes !== undefined &&
      !(
        Number.isInteger(expireMinutes) &&
        Number(expireMinutes) >= 1 &&
        Number(expireMinutes) <= 1440
      )
    ) {
      problems.push('config.expireMinutes must be an integer from 1 to 1440');
    }
    return problems;
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (input.currency.toUpperCase() !== PAYOS_CURRENCY) {
      throw new AppException(PaymentErrorCode.CURRENCY_NOT_SUPPORTED, {
        message: 'payOS only accepts VND',
        details: { reason: 'CURRENCY_NOT_SUPPORTED' },
      });
    }
    if (!input.returnUrl) {
      throw new AppException(PaymentErrorCode.RETURN_URL_REQUIRED, {
        details: { reason: 'RETURN_URL_REQUIRED' },
      });
    }
    const orderCodeValue = this.orderCode(input.orderNumber);
    if (
      orderCodeValue > BigInt(Number.MAX_SAFE_INTEGER) ||
      input.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw new AppException(PaymentErrorCode.AMOUNT_OUT_OF_RANGE, {
        message: 'Order number or amount exceeds the payOS limit',
        details: { reason: 'AMOUNT_OUT_OF_RANGE' },
      });
    }
    const { credentials, expireMinutes, bankName } = this.account(input.providerAccount ?? null);
    const orderCode = Number(orderCodeValue);
    const amount = Number(input.amountMinor);
    const expiresAt = new Date(input.createdAt.getTime() + expireMinutes * 60_000);
    const request = {
      orderCode,
      amount,
      description: payosDescription(input.orderNumber),
      items: [{ name: 'Payment', quantity: 1, price: amount }],
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl || input.returnUrl,
      expiredAt: Math.floor(expiresAt.getTime() / 1000),
    };

    let data: Record<string, unknown>;
    try {
      data = await this.api.createPaymentLink(credentials, request);
    } catch (error) {
      if (error instanceof PayosApiError && error.code === PAYOS_ORDER_EXISTS) {
        throw new AppException(PaymentErrorCode.PROVIDER_ORDER_CODE_TAKEN, {
          message: 'payOS reports this order code is already used on this channel',
          details: { reason: 'PAYOS_ORDER_CODE_TAKEN', orderCode },
        });
      }
      throw error;
    }

    if (Number(data.amount) !== amount || Number(data.orderCode) !== orderCode) {
      throw new Error('payOS payment link does not match the requested order');
    }
    const checkoutUrl = stringField(data.checkoutUrl);
    if (!checkoutUrl) throw new Error('payOS response has no checkoutUrl');
    const qrPayload = optionalString(data.qrCode);
    const bankBin = optionalString(data.bin);
    const accountNumber = optionalString(data.accountNumber);
    const accountName = optionalString(data.accountName);
    const reference = optionalString(data.description) ?? request.description;
    const nextAction: ProviderCheckoutResult['nextAction'] =
      qrPayload && bankBin && accountNumber && accountName
        ? {
            type: 'qr',
            payload: qrPayload,
            bankBin,
            bankName: bankName ?? vnBankName(bankBin) ?? `Bank BIN ${bankBin}`,
            accountNumber,
            accountName,
            amountMinor: input.amountMinor,
            currency: PAYOS_CURRENCY,
            reference,
            expiresAt,
          }
        : { type: 'redirect', url: checkoutUrl };
    return {
      providerPaymentId: optionalString(data.paymentLinkId) ?? optionalString(data.id),
      providerOrderId: String(orderCode),
      methodType: payment_method_type.bank_transfer,
      status: payment_attempt_status.requires_action,
      checkoutUrl,
      qrPayload,
      expiresAt,
      nextAction,
      providerData: {
        orderCode: String(orderCode),
        paymentLinkId: optionalString(data.paymentLinkId) ?? optionalString(data.id),
      },
      responsePayload: { provider: this.code, status: optionalString(data.status) },
    };
  }

  async cancelCheckout(input: ProviderCancelCheckoutInput): Promise<void> {
    const { credentials } = this.account(input.providerAccount);
    const orderCode =
      input.providerOrderId ??
      (input.orderNumber === null ? undefined : this.orderCode(input.orderNumber).toString());
    if (!orderCode) return;
    await this.api.cancelPaymentLink(credentials, orderCode, input.reason);
  }

  async queryPayment(input: ProviderPaymentQueryInput): Promise<ProviderPaymentState> {
    const { credentials } = this.account(input.providerAccount);
    const orderCode =
      input.providerOrderId ??
      (input.orderNumber === null ? undefined : this.orderCode(input.orderNumber).toString());
    if (!orderCode) throw new Error('payOS attempt has no orderCode');
    const data = await this.api.getPaymentLink(credentials, orderCode);
    const status = stringField(data.status).toUpperCase();
    const base = {
      providerEventId: `payos:query:${orderCode}`,
      eventType: 'payos.query',
      providerOrderId: orderCode,
      providerPaymentId: optionalString(data.id),
      currency: PAYOS_CURRENCY,
      payload: data,
    };
    if (status === 'PAID')
      return {
        ...base,
        status: 'succeeded',
        amountMinor: wholeAmount(data.amountPaid ?? data.amount),
      };
    if (status === 'CANCELLED') {
      return {
        ...base,
        status: 'canceled',
        failureCode: 'CANCELLED',
        failureMessage:
          optionalString(data.cancellationReason) ?? 'The payer cancelled the payment',
      };
    }
    if (status === 'EXPIRED')
      return {
        ...base,
        status: 'expired',
        failureCode: 'EXPIRED',
        failureMessage: 'The payment session has expired',
      };
    if (status === 'FAILED')
      return {
        ...base,
        status: 'failed',
        failureCode: 'FAILED',
        failureMessage: 'The transaction was declined',
      };
    return { ...base, status: null };
  }

  inspectWebhook(request: ProviderWebhookRequest): ProviderWebhookInspection {
    const data = asRecord(webhookBodyObject(request).data);
    return {
      accountRef: null,
      merchantReference:
        data.orderCode === undefined || data.orderCode === null ? null : String(data.orderCode),
      providerPaymentId: optionalString(data.paymentLinkId),
      paymentIntentPublicId: null,
    };
  }

  verifyWebhook(
    request: ProviderWebhookRequest,
    providerAccount: ProviderAccountContext | null,
  ): ProviderWebhookSignatureCheck {
    const checksumKey = providerAccount?.credentials.checksumKey;
    if (typeof checksumKey !== 'string' || !checksumKey) return { outcome: 'no_secret' };
    const body = webhookBodyObject(request);
    const signature = stringField(body.signature);
    if (!signature) return { outcome: 'invalid', reason: 'Missing signature' };
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))
      return { outcome: 'invalid', reason: 'Missing data' };
    if (!verifyPayosDataSignature(checksumKey, body.data as Record<string, unknown>, signature)) {
      return { outcome: 'invalid', reason: 'Signature mismatch' };
    }
    return { outcome: 'verified', signature: signature.toLowerCase() };
  }

  async normalizeWebhook(
    request: ProviderWebhookRequest,
    providerAccount?: ProviderAccountContext | null,
  ): Promise<ProviderWebhookNormalization> {
    const body = webhookBodyObject(request);
    const data = asRecord(body.data);
    if (data.orderCode === undefined || data.orderCode === null)
      throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
        message: 'payOS webhook is missing data.orderCode',
      });
    const orderCode = String(data.orderCode);
    const paid =
      stringField(body.code) === '00' &&
      body.success === true &&
      (data.code === undefined || stringField(data.code) === '00');
    const clientId =
      providerAccount?.externalAccountRef ?? stringField(providerAccount?.credentials.clientId);
    return {
      providerEventId: `payos:${clientId}:${orderCode}:${stringField(data.reference) || stringField(data.paymentLinkId)}`,
      eventType: 'payos.webhook',
      providerOrderId: orderCode,
      providerPaymentId: optionalString(data.paymentLinkId),
      paymentIntentPublicId: null,
      status: paid ? 'succeeded' : null,
      amountMinor: paid ? wholeAmount(data.amount) : null,
      currency: paid ? (optionalString(data.currency)?.toUpperCase() ?? PAYOS_CURRENCY) : null,
      payload: body,
    };
  }

  acknowledgeWebhook(outcome: ProviderWebhookOutcome): ProviderWebhookAck {
    return providerWebhookAcknowledgement(outcome);
  }

  private orderCode(orderNumber: bigint): bigint {
    return orderNumber + this.orderCodeOffset;
  }

  private account(providerAccount: ProviderAccountContext | null) {
    const credentials = providerAccount?.credentials ?? {};
    const clientId = credentials.clientId;
    const apiKey = credentials.apiKey;
    const checksumKey = credentials.checksumKey;
    if (
      typeof clientId !== 'string' ||
      typeof apiKey !== 'string' ||
      typeof checksumKey !== 'string' ||
      !clientId ||
      !apiKey ||
      !checksumKey
    ) {
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_INVALID, {
        message: 'payOS account is missing configuration (clientId/apiKey/checksumKey)',
        details: { reason: 'PROVIDER_ACCOUNT_INVALID' },
      });
    }
    const configured = providerAccount?.config?.expireMinutes;
    const configuredBank = providerAccount?.config?.bankName;
    return {
      credentials: { clientId, apiKey, checksumKey } satisfies PayosCredentials,
      expireMinutes: Number.isInteger(configured)
        ? Number(configured)
        : PAYOS_DEFAULT_EXPIRE_MINUTES,
      bankName:
        typeof configuredBank === 'string' && configuredBank.trim() ? configuredBank.trim() : null,
    };
  }
}

export function payosDescription(orderNumber: bigint): string {
  return `QZ${orderNumber.toString(36).toUpperCase()}`.slice(0, PAYOS_DESCRIPTION_MAX);
}

function wholeAmount(value: unknown): bigint {
  return parseProviderAmount(value, 'payOS amount must be a non-negative integer', 'amount');
}
