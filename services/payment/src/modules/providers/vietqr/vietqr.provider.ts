import { Injectable } from '@nestjs/common';
import { payment_attempt_status, payment_method_type } from '@app/infrastructure/prisma/client';
import { AppException } from '@netverse/nest-kit';
import { PaymentErrorCode } from '@app/modules/payments/payment-error-codes';
import { parseProviderAmount } from '../shared/parse-provider-amount.util';
import { providerWebhookAcknowledgement } from '../shared/provider-webhook-ack.util';
import {
  PaymentProvider,
  ProviderAccountContext,
  ProviderAccountValidationInput,
  ProviderCapabilities,
  ProviderCheckoutInput,
  ProviderCheckoutResult,
  ProviderWebhookAck,
  ProviderWebhookInspection,
  ProviderWebhookNormalization,
  ProviderWebhookOutcome,
  ProviderWebhookRequest,
  ProviderWebhookSignatureCheck,
} from '../contracts/payment-provider.contract';
import { bankTransferPaymentId } from '../shared/bank-transfer.util';
import { webhookBodyObject } from '../shared/webhook-payload.util';
import { buildBankTransferQrPayload } from './emvco-qr.util';
import { parseSepayTransaction, verifySepayRequest } from './feeds/sepay.feed';
import {
  VIETQR_DEFAULT_PREFIX,
  buildBankTransferQrReference,
  extractBankTransferQrReferences,
} from './vietqr-reference.util';

export const VIETQR_PROVIDER_CODE = 'vietqr';
const VIETQR_CURRENCY = 'VND';
const VIETQR_DEFAULT_TTL_MINUTES = 30;

interface BankTransferQrConfig {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  referencePrefix: string;
  ttlMinutes: number;
}

@Injectable()
export class BankTransferQrProvider implements PaymentProvider {
  code = VIETQR_PROVIDER_CODE;

  capabilities(): ProviderCapabilities {
    return {
      checkout: true,
      checkoutFlow: 'qr',
      queryPayment: false,
      refund: false,
      partialRefund: false,
      recurring: false,
      tokenization: false,
      webhookReportsAmount: true,
      webhookMethods: ['POST'],
      plaintextCredentialsAllowed: false,
      requiresWebhookSecret: true,
      operatorConfirm: true,
      acceptsLateSuccess: true,
    };
  }

  validateAccount(input: ProviderAccountValidationInput): string[] {
    const problems: string[] = [];
    const config = input.config ?? {};
    if (typeof config.bankBin !== 'string' || !/^\d{6}$/.test(config.bankBin))
      problems.push('config.bankBin must be 6 digits');
    if (
      typeof config.accountNumber !== 'string' ||
      !/^[0-9A-Z]{4,19}$/.test(config.accountNumber)
    ) {
      problems.push('config.accountNumber is invalid');
    }
    if (typeof config.bankName !== 'string' || !config.bankName.trim())
      problems.push('config.bankName is required');
    if (typeof config.accountName !== 'string' || !config.accountName.trim())
      problems.push('config.accountName is required');
    if (
      config.referencePrefix !== undefined &&
      (typeof config.referencePrefix !== 'string' || !/^[A-Z]{2,6}$/.test(config.referencePrefix))
    ) {
      problems.push('config.referencePrefix must be 2 to 6 uppercase letters');
    }
    if (
      config.ttlMinutes !== undefined &&
      !(
        Number.isInteger(config.ttlMinutes) &&
        Number(config.ttlMinutes) >= 5 &&
        Number(config.ttlMinutes) <= 1440
      )
    ) {
      problems.push('config.ttlMinutes must be an integer from 5 to 1440');
    }
    if (!input.externalAccountRef || input.externalAccountRef !== config.accountNumber) {
      problems.push('externalAccountRef must match config.accountNumber');
    }
    if (input.credentials) {
      const { sepayApiKey, sepayHmacSecret } = input.credentials;
      const hasKey = typeof sepayApiKey === 'string' && sepayApiKey.length > 0;
      const hasSecret = typeof sepayHmacSecret === 'string' && sepayHmacSecret.length > 0;
      if (!hasKey && !hasSecret)
        problems.push('credentials must include sepayApiKey or sepayHmacSecret');
    }
    return problems;
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult> {
    if (input.currency.toUpperCase() !== VIETQR_CURRENCY) {
      throw new AppException(PaymentErrorCode.CURRENCY_NOT_SUPPORTED, {
        message: 'VietQR only accepts VND transfers',
        details: { reason: 'CURRENCY_NOT_SUPPORTED' },
      });
    }
    const config = this.config(input.providerAccount ?? null);
    const reference = buildBankTransferQrReference(config.referencePrefix, input.orderNumber);
    const payload = buildBankTransferQrPayload({
      bankBin: config.bankBin,
      accountNumber: config.accountNumber,
      amount: input.amountMinor,
      content: reference,
    });
    const expiresAt = new Date(input.createdAt.getTime() + config.ttlMinutes * 60_000);
    return {
      providerOrderId: reference,
      providerPaymentId: null,
      methodType: payment_method_type.qr_code,
      status: payment_attempt_status.requires_action,
      qrPayload: payload,
      expiresAt,
      nextAction: {
        type: 'qr',
        payload,
        bankBin: config.bankBin,
        bankName: config.bankName,
        accountNumber: config.accountNumber,
        accountName: config.accountName,
        amountMinor: input.amountMinor,
        currency: VIETQR_CURRENCY,
        reference,
        expiresAt,
      },
      providerData: {
        reference,
        bankBin: config.bankBin,
        bankName: config.bankName,
        accountNumber: config.accountNumber,
        accountName: config.accountName,
      },
      responsePayload: { provider: this.code },
    };
  }

  inspectWebhook(
    request: ProviderWebhookRequest,
    routeAccount?: ProviderAccountContext | null,
  ): ProviderWebhookInspection {
    const transaction = parseSepayTransaction(webhookBodyObject(request));
    return {
      accountRef: transaction.accountNumber,
      merchantReference: null,
      merchantReferenceCandidates: extractBankTransferQrReferences(
        [transaction.code, transaction.content, transaction.description],
        this.prefixOf(routeAccount ?? null),
      ),
      providerPaymentId: bankReference(transaction),
      paymentIntentPublicId: null,
    };
  }

  verifyWebhook(
    request: ProviderWebhookRequest,
    providerAccount: ProviderAccountContext | null,
  ): ProviderWebhookSignatureCheck {
    if (!providerAccount) return { outcome: 'no_secret' };
    const { sepayApiKey, sepayHmacSecret } = providerAccount.credentials;
    return verifySepayRequest(request, {
      apiKey: typeof sepayApiKey === 'string' && sepayApiKey ? sepayApiKey : null,
      hmacSecret: typeof sepayHmacSecret === 'string' && sepayHmacSecret ? sepayHmacSecret : null,
    });
  }

  async normalizeWebhook(
    request: ProviderWebhookRequest,
    providerAccount?: ProviderAccountContext | null,
  ): Promise<ProviderWebhookNormalization> {
    const body = webhookBodyObject(request);
    const transaction = parseSepayTransaction(body);
    if (!transaction.id)
      throw new AppException(PaymentErrorCode.WEBHOOK_PAYLOAD_INVALID, {
        message: 'SePay webhook is missing id',
      });
    const accountRef = providerAccount?.externalAccountRef ?? transaction.accountNumber ?? '';
    const toThisAccount =
      !providerAccount?.externalAccountRef ||
      transaction.accountNumber === providerAccount.externalAccountRef ||
      transaction.subAccount === providerAccount.externalAccountRef;
    const incoming = transaction.transferType === 'in' && toThisAccount;
    return {
      providerEventId: `sepay:${accountRef}:${transaction.id}`,
      eventType: `sepay.${transaction.transferType ?? 'unknown'}`,
      providerOrderId: null,
      providerPaymentId: bankReference(transaction),
      paymentIntentPublicId: null,
      status: incoming ? 'succeeded' : null,
      amountMinor: incoming ? wholeVnd(transaction.transferAmount) : null,
      currency: incoming ? VIETQR_CURRENCY : null,
      payload: body,
    };
  }

  acknowledgeWebhook(outcome: ProviderWebhookOutcome): ProviderWebhookAck {
    return providerWebhookAcknowledgement(outcome);
  }

  private prefixOf(account: ProviderAccountContext | null) {
    const prefix = account?.config?.referencePrefix;
    return typeof prefix === 'string' && prefix ? prefix : VIETQR_DEFAULT_PREFIX;
  }

  private config(account: ProviderAccountContext | null): BankTransferQrConfig {
    const config = account?.config ?? {};
    const { bankBin, bankName, accountNumber, accountName } = config;
    if (
      typeof bankBin !== 'string' ||
      typeof bankName !== 'string' ||
      typeof accountNumber !== 'string' ||
      typeof accountName !== 'string' ||
      !bankBin ||
      !accountNumber
    ) {
      throw new AppException(PaymentErrorCode.PROVIDER_ACCOUNT_INVALID, {
        message:
          'VietQR account is missing configuration (bankBin/accountNumber/bankName/accountName)',
        details: {
          reason: 'PROVIDER_ACCOUNT_INVALID',
        },
      });
    }
    return {
      bankBin,
      bankName,
      accountNumber,
      accountName,
      referencePrefix: this.prefixOf(account),
      ttlMinutes: Number.isInteger(config.ttlMinutes)
        ? Number(config.ttlMinutes)
        : VIETQR_DEFAULT_TTL_MINUTES,
    };
  }
}

function bankReference(transaction: { id: string; referenceCode: string | null }) {
  if (transaction.referenceCode) return bankTransferPaymentId(transaction.referenceCode);
  return transaction.id ? `sepay:${transaction.id}` : null;
}

function wholeVnd(value: unknown): bigint {
  return parseProviderAmount(
    value,
    'SePay transferAmount must be a non-negative integer',
    'transferAmount',
  );
}
