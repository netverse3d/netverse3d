import { verifyPayloadSignature } from '@app/common/utils/signature.util';
import {
  ProviderAccountContext,
  ProviderWebhookSignatureCheck,
} from '../contracts/payment-provider.contract';

export const WEBHOOK_SIGNATURE_HEADER = 'x-signature';

const WEBHOOK_SECRET_KEYS = ['webhook_secret', 'webhookSecret'] as const;

export function extractWebhookSecret(
  providerAccount: ProviderAccountContext | null,
): string | null {
  const credentials = providerAccount?.credentials;
  if (!credentials) return null;
  for (const key of WEBHOOK_SECRET_KEYS) {
    const value = credentials[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export function verifyHmacWebhookSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  providerAccount: ProviderAccountContext | null,
): ProviderWebhookSignatureCheck {
  const secret = extractWebhookSecret(providerAccount);
  if (!secret) return { outcome: 'no_secret' };

  const headerValue = headers[WEBHOOK_SIGNATURE_HEADER];
  const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!signature)
    return { outcome: 'invalid', reason: `Missing ${WEBHOOK_SIGNATURE_HEADER} header` };
  if (!verifyPayloadSignature(secret, rawBody, signature)) {
    return { outcome: 'invalid', reason: 'Signature mismatch' };
  }
  return { outcome: 'verified', signature };
}
