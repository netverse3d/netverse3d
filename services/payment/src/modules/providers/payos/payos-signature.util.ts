import { createHmac } from 'crypto';
import { safeEqualString } from '@app/common/utils/hash.util';

export interface PayosCreateSignatureFields {
  amount: number;
  cancelUrl: string;
  description: string;
  orderCode: number;
  returnUrl: string;
}

export function payosCreateSignatureData(fields: PayosCreateSignatureFields): string {
  return `amount=${fields.amount}&cancelUrl=${fields.cancelUrl}&description=${fields.description}&orderCode=${fields.orderCode}&returnUrl=${fields.returnUrl}`;
}

export function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortObjectKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function payosDataString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map((key) => {
      const raw = data[key];
      let value: string;
      if (raw === null || raw === 'null' || raw === 'undefined') value = '';
      else if (Array.isArray(raw) || typeof raw === 'object')
        value = JSON.stringify(sortObjectKeys(raw));
      else value = String(raw);
      return `${key}=${value}`;
    })
    .join('&');
}

export function payosSign(checksumKey: string, data: string): string {
  return createHmac('sha256', checksumKey).update(data, 'utf8').digest('hex');
}

export function verifyPayosDataSignature(
  checksumKey: string,
  data: Record<string, unknown>,
  signature: string,
): boolean {
  if (!signature) return false;
  return safeEqualString(payosSign(checksumKey, payosDataString(data)), signature.toLowerCase());
}
