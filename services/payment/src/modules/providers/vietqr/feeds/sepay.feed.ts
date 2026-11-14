import { createHmac } from 'crypto';
import { safeEqualString } from '@app/common/utils/hash.util';
import {
  ProviderWebhookRequest,
  ProviderWebhookSignatureCheck,
} from '../../contracts/payment-provider.contract';

export const SEPAY_MAX_CLOCK_SKEW_SECONDS = 300;

export interface SepayTransaction {
  id: string;
  gateway: string | null;
  transactionDate: string | null;
  accountNumber: string | null;
  subAccount: string | null;
  code: string | null;
  content: string | null;
  description: string | null;
  transferType: string | null;
  transferAmount: unknown;
  referenceCode: string | null;
}

export interface SepayCredentials {
  apiKey: string | null;
  hmacSecret: string | null;
}

function header(headers: ProviderWebhookRequest['headers'], name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.length > 0 ? first : null;
}

export function verifySepayRequest(
  request: ProviderWebhookRequest,
  credentials: SepayCredentials,
  now: Date = new Date(),
): ProviderWebhookSignatureCheck {
  if (!credentials.apiKey && !credentials.hmacSecret) return { outcome: 'no_secret' };

  const signatureHeader = header(request.headers, 'x-sepay-signature');
  if (credentials.hmacSecret && signatureHeader) {
    const timestampHeader = header(request.headers, 'x-sepay-timestamp');
    const timestamp = Number(timestampHeader);
    if (!timestampHeader || !Number.isFinite(timestamp))
      return { outcome: 'invalid', reason: 'Missing X-SePay-Timestamp' };
    const seconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
    if (Math.abs(Math.floor(now.getTime() / 1000) - seconds) > SEPAY_MAX_CLOCK_SKEW_SECONDS) {
      return { outcome: 'invalid', reason: 'X-SePay-Timestamp outside allowed window' };
    }
    const received = signatureHeader.replace(/^sha256=/i, '').toLowerCase();
    const expected = createHmac('sha256', credentials.hmacSecret)
      .update(`${timestampHeader}.${request.rawBody}`, 'utf8')
      .digest('hex');
    return safeEqualString(expected, received)
      ? { outcome: 'verified', signature: `sha256=${received}` }
      : { outcome: 'invalid', reason: 'Signature mismatch' };
  }

  const authorization = header(request.headers, 'authorization');
  if (credentials.apiKey && authorization) {
    const match = /^Apikey\s+(.+)$/i.exec(authorization.trim());
    const apiKey = match?.[1]?.trim();
    if (apiKey && safeEqualString(apiKey, credentials.apiKey))
      return { outcome: 'verified', signature: 'apikey' };
    return { outcome: 'invalid', reason: 'API key mismatch' };
  }
  return { outcome: 'invalid', reason: 'Missing SePay authentication' };
}

export function parseSepayTransaction(body: Record<string, unknown>): SepayTransaction {
  const text = (value: unknown) =>
    value === undefined || value === null || value === '' ? null : String(value);
  return {
    id: text(body.id) ?? '',
    gateway: text(body.gateway),
    transactionDate: text(body.transactionDate),
    accountNumber: text(body.accountNumber),
    subAccount: text(body.subAccount),
    code: text(body.code),
    content: text(body.content),
    description: text(body.description),
    transferType: text(body.transferType),
    transferAmount: body.transferAmount,
    referenceCode: text(body.referenceCode),
  };
}
