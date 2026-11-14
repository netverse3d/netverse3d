import { Inject, Injectable } from '@nestjs/common';
import { payment_attempt_status, payment_method_type } from '@app/infrastructure/prisma/client';
import { AppException } from '@app/common/errors/app.exception';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import {
  PaymentProvider,
  PROVIDER_RUNTIME_CONFIG,
  ProviderAccountContext,
  ProviderAccountValidationInput,
  ProviderCapabilities,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderPaymentQueryInput,
  ProviderPaymentState,
  ProviderRefundInput,
  ProviderRefundState,
  ProviderRuntimeConfig,
  ProviderWebhookAck,
  ProviderWebhookInspection,
  ProviderWebhookNormalization,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
  ProviderWebhookSignatureCheck,
} from '../contracts/payment-provider.contract';
import { VnpayApiClient } from './vnpay-api.client';
import { formatVnpayDate } from './vnpay-date.util';
import {
  vnpayAck,
  vnpayAmountToMinor,
  vnpayFailureMessage,
  vnpayIpnStatus,
  vnpayParams,
  vnpaySecrets,
  vnpayTransactionNo,
} from './vnpay-mapper';
import { signVnpayParams, verifyVnpayParams } from './vnpay-signature.util';
import {
  VNPAY_CURRENCY,
  VNPAY_DEFAULT_EXPIRE_MINUTES,
  VNPAY_DEFAULT_LOCALE,
  VNPAY_DEFAULT_ORDER_TYPE,
  VNPAY_PROVIDER_CODE,
  VNPAY_QUERY_NOT_FOUND,
  VNPAY_SUCCESS,
  VNPAY_TXN_FAILED,
  VNPAY_TXN_PENDING,
  VNPAY_VERSION,
} from './vnpay.constants';

const TMN_CODE_PATTERN = /^[A-Za-z0-9]{4,20}$/;

interface VnpayAccount {
  tmnCode: string;
  secrets: string[];
  expireMinutes: number;
  locale: string;
  orderType: string;
}

@Injectable()
export class VnpayProvider implements PaymentProvider {
  code = VNPAY_PROVIDER_CODE;
  private readonly api: VnpayApiClient;

  constructor(@Inject(PROVIDER_RUNTIME_CONFIG) private readonly config: ProviderRuntimeConfig) {
    this.api = new VnpayApiClient(config.vnpayApiUrl, config.httpTimeoutMs);
  }

  capabilities(): ProviderCapabilities {
    return {
      checkout: true,
      checkoutFlow: 'redirect',
      queryPayment: true,
      refund: true,
      partialRefund: true,
      recurring: false,
      tokenization: false,
      webhookReportsAmount: true,
      webhookMethods: ['GET'],
      plaintextCredentialsAllowed: false,
      requiresWebhookSecret: true,
      operatorConfirm: false,
      acceptsLateSuccess: true,
    };
  }

  validateAccount(input: ProviderAccountValidationInput): string[] {
    const problems: string[] = [];
    if (!input.externalAccountRef || !TMN_CODE_PATTERN.test(input.externalAccountRef)) {
      problems.push('externalAccountRef must be vnp_TmnCode');
    }
    if (input.credentials) {
      if (
        typeof input.credentials.hashSecret !== 'string' ||
        input.credentials.hashSecret.length < 8
      ) {
        problems.push('credentials.hashSecret is required');
      }
      if (
        input.credentials.previousHashSecret !== undefined &&
        typeof input.credentials.previousHashSecret !== 'string'
      ) {
        problems.push('credentials.previousHashSecret must be a string');
      }
    }
    const config = input.config ?? {};
    if (
      config.expireMinutes !== undefined &&
      !(
        Number.isInteger(config.expireMinutes) &&
        Number(config.expireMinutes) >= 5 &&
        Number(config.expireMinutes) <= 1440
      )
    ) {
      problems.push('config.expireMinutes must be an integer from 5 to 1440');
    }
    if (config.locale !== undefined && config.locale !== 'vn' && config.locale !== 'en')
      problems.push('config.locale must be vn or en');
    if (
      config.orderType !== undefined &&
      (typeof config.orderType !== 'string' || !/^[a-z0-9_]{1,20}$/.test(config.orderType))
    ) {
      problems.push('config.orderType is invalid');
    }
    return problems;
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (input.currency.toUpperCase() !== VNPAY_CURRENCY) {
      throw new AppException(PaymentErrorCode.CURRENCY_NOT_SUPPORTED, {
        message: 'VNPAY only accepts VND',
        details: { reason: 'CURRENCY_NOT_SUPPORTED' },
      });
    }
    if (!input.context.clientIp) {
      throw new AppException(PaymentErrorCode.PAYER_IP_REQUIRED, {
        details: { reason: 'PAYER_IP_REQUIRED' },
      });
    }
    if (!input.returnUrl) {
      throw new AppException(PaymentErrorCode.RETURN_URL_REQUIRED, {
        details: { reason: 'RETURN_URL_REQUIRED' },
      });
    }
    const account = this.account(input.providerAccount ?? null);
    const createDate = formatVnpayDate(input.createdAt);
    const expiresAt = new Date(input.createdAt.getTime() + account.expireMinutes * 60_000);
    const params: Record<string, string> = {
      vnp_Version: VNPAY_VERSION,
      vnp_Command: 'pay',
      vnp_TmnCode: account.tmnCode,
      vnp_Amount: (input.amountMinor * 100n).toString(),
      vnp_CurrCode: VNPAY_CURRENCY,
      vnp_TxnRef: input.providerOrderRef,
      vnp_OrderInfo: this.orderInfo(input.orderNumber),
      vnp_OrderType: account.orderType,
      vnp_Locale: account.locale,
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: input.context.clientIp,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: formatVnpayDate(expiresAt),
    };
    const secret = account.secrets[0];
    if (!secret)
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_INVALID, {
        details: { reason: 'PROVIDER_ACCOUNT_INVALID' },
      });
    const { query, secureHash } = signVnpayParams(params, secret);
    const url = `${this.config.vnpayPaymentUrl}?${query}&vnp_SecureHash=${secureHash}`;
    return {
      providerOrderId: input.providerOrderRef,
      providerPaymentId: null,
      methodType: payment_method_type.card,
      status: payment_attempt_status.requires_action,
      checkoutUrl: url,
      expiresAt,
      nextAction: { type: 'redirect', url },
      providerData: {
        tmnCode: account.tmnCode,
        txnRef: input.providerOrderRef,
        createDate,
        orderInfo: params.vnp_OrderInfo,
      },
      responsePayload: { provider: this.code },
    };
  }

  inspectWebhook(request: ProviderWebhookRequest): ProviderWebhookInspection {
    const params = vnpayParams(request);
    return {
      accountRef: params.vnp_TmnCode ?? null,
      merchantReference: params.vnp_TxnRef ?? null,
      providerPaymentId: null,
      paymentIntentPublicId: null,
    };
  }

  verifyWebhook(
    request: ProviderWebhookRequest,
    providerAccount: ProviderAccountContext | null,
  ): ProviderWebhookSignatureCheck {
    const secrets = vnpaySecrets(providerAccount);
    if (!providerAccount || secrets.length === 0) return { outcome: 'no_secret' };
    const params = vnpayParams(request);
    if (!params.vnp_SecureHash) return { outcome: 'invalid', reason: 'Missing vnp_SecureHash' };
    if (
      providerAccount.externalAccountRef &&
      params.vnp_TmnCode !== providerAccount.externalAccountRef
    ) {
      return { outcome: 'invalid', reason: 'vnp_TmnCode does not match provider account' };
    }
    if (!verifyVnpayParams(params, secrets))
      return { outcome: 'invalid', reason: 'Checksum mismatch' };
    return { outcome: 'verified', signature: params.vnp_SecureHash.toLowerCase() };
  }

  async normalizeWebhook(request: ProviderWebhookRequest): Promise<ProviderWebhookNormalization> {
    const params = vnpayParams(request);
    const txnRef = params.vnp_TxnRef;
    const responseCode = params.vnp_ResponseCode ?? '';
    const transactionStatus = params.vnp_TransactionStatus ?? '';
    if (!txnRef || !responseCode)
      throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
        message: 'VNPAY IPN is missing vnp_TxnRef or vnp_ResponseCode',
      });
    const status = vnpayIpnStatus(responseCode, transactionStatus);
    const failed = status !== 'succeeded';
    const payload = { ...params };
    delete payload.vnp_SecureHash;
    delete payload.vnp_SecureHashType;
    return {
      providerEventId: `vnpay:${params.vnp_TmnCode ?? ''}:${txnRef}:${responseCode}:${transactionStatus}`,
      eventType: 'vnpay.ipn',
      providerOrderId: txnRef,
      providerPaymentId: vnpayTransactionNo(params.vnp_TransactionNo),
      paymentIntentPublicId: null,
      status,
      amountMinor: vnpayAmountToMinor(params.vnp_Amount),
      currency: VNPAY_CURRENCY,
      failureCode: failed ? responseCode : null,
      failureMessage: failed ? vnpayFailureMessage(responseCode) : null,
      payload,
    };
  }

  acknowledgeWebhook(outcome: ProviderWebhookOutcome): ProviderWebhookAck {
    return vnpayAck(outcome);
  }

  async queryPayment(input: ProviderPaymentQueryInput): Promise<ProviderPaymentState> {
    const account = this.account(input.providerAccount);
    const txnRef = stringData(input.providerData, 'txnRef') ?? input.providerOrderId;
    if (!txnRef) throw new Error('VNPAY attempt has no vnp_TxnRef');
    const response = await this.api.queryDr(
      { tmnCode: account.tmnCode, secrets: account.secrets },
      {
        txnRef,
        transactionDate:
          stringData(input.providerData, 'createDate') ?? formatVnpayDate(input.attemptCreatedAt),
        orderInfo: `Tra cuu ${txnRef}`,
        transactionNo: input.providerPaymentId,
        ipAddr: input.context.clientIp ?? this.config.serverIp,
      },
    );
    const base = {
      providerEventId: `vnpay:querydr:${txnRef}`,
      eventType: 'vnpay.querydr',
      providerOrderId: txnRef,
      providerPaymentId: vnpayTransactionNo(response.vnp_TransactionNo),
      currency: VNPAY_CURRENCY,
      payload: response as Record<string, unknown>,
    };
    if (response.vnp_ResponseCode === VNPAY_QUERY_NOT_FOUND) {
      const expired = this.pastExpiry(input.attemptExpiresAt);
      return {
        ...base,
        providerPaymentId: null,
        status: expired ? 'expired' : null,
        failureCode: expired ? 'EXPIRED' : null,
        failureMessage: expired ? 'The payment session has expired' : null,
      };
    }
    if (response.vnp_ResponseCode !== VNPAY_SUCCESS) return { ...base, status: null };
    const transactionStatus = response.vnp_TransactionStatus;
    if (transactionStatus === VNPAY_SUCCESS) {
      return { ...base, status: 'succeeded', amountMinor: vnpayAmountToMinor(response.vnp_Amount) };
    }
    if (transactionStatus === VNPAY_TXN_FAILED) {
      return {
        ...base,
        status: 'failed',
        failureCode: transactionStatus,
        failureMessage: vnpayFailureMessage(transactionStatus),
      };
    }
    if (transactionStatus === VNPAY_TXN_PENDING && this.pastExpiry(input.attemptExpiresAt)) {
      return {
        ...base,
        status: 'expired',
        failureCode: 'EXPIRED',
        failureMessage: 'The payment session has expired',
      };
    }
    return { ...base, status: null };
  }

  async createRefund(input: ProviderRefundInput): Promise<ProviderRefundState> {
    const account = this.account(input.providerAccount);
    const txnRef = stringData(input.providerData, 'txnRef') ?? input.providerOrderId;
    if (!txnRef) throw new Error('VNPAY attempt has no vnp_TxnRef');
    const response = await this.api.refund(
      { tmnCode: account.tmnCode, secrets: account.secrets },
      {
        txnRef,
        transactionDate:
          stringData(input.providerData, 'createDate') ??
          formatVnpayDate(input.attemptCreatedAt ?? input.paidAt ?? new Date()),
        transactionType: input.isFullRefund ? '02' : '03',
        amountMinor: input.amountMinor,
        transactionNo: input.providerPaymentId,
        orderInfo: `Hoan tien ${input.refundPublicId}`,
        createBy: 'payment-gateway-service',
        ipAddr: input.context.clientIp ?? this.config.serverIp,
      },
    );
    const code = response.vnp_ResponseCode;
    if (code === VNPAY_SUCCESS) {
      return {
        status: 'succeeded',
        providerRefundId: vnpayTransactionNo(response.vnp_TransactionNo) ?? input.refundPublicId,
        payload: response,
      };
    }
    if (code === '94' || code === '99' || !code) return { status: 'pending', payload: response };
    return {
      status: 'failed',
      failureReason: `VNPAY ${code}: ${response.vnp_Message ?? ''}`.trim(),
      payload: response,
    };
  }

  private orderInfo(orderNumber: bigint) {
    return `Payment ${orderNumber.toString()}`;
  }

  private pastExpiry(expiresAt: Date | null) {
    if (!expiresAt) return false;
    return Date.now() > expiresAt.getTime() + this.config.expiryGraceMinutes * 60_000;
  }

  private account(providerAccount: ProviderAccountContext | null): VnpayAccount {
    const secrets = vnpaySecrets(providerAccount);
    const tmnCode = providerAccount?.externalAccountRef;
    if (!providerAccount || !tmnCode || secrets.length === 0) {
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_INVALID, {
        message: 'VNPAY account is missing configuration (vnp_TmnCode/hashSecret)',
        details: { reason: 'PROVIDER_ACCOUNT_INVALID' },
      });
    }
    const config = providerAccount.config ?? {};
    return {
      tmnCode,
      secrets,
      expireMinutes: Number.isInteger(config.expireMinutes)
        ? Number(config.expireMinutes)
        : VNPAY_DEFAULT_EXPIRE_MINUTES,
      locale: typeof config.locale === 'string' ? config.locale : VNPAY_DEFAULT_LOCALE,
      orderType: typeof config.orderType === 'string' ? config.orderType : VNPAY_DEFAULT_ORDER_TYPE,
    };
  }
}

function stringData(data: Record<string, unknown> | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
