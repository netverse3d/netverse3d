import { createHmac } from 'crypto';
import { safeEqualString } from '@app/modules/shared/utils/hash.util';

const HASH_FIELDS = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

export function hmacSha512Hex(secret: string, data: string): string {
  return createHmac('sha512', secret).update(data, 'utf8').digest('hex');
}

export function vnpayCanonicalQuery(
  params: Record<string, string>,
  options: { skipEmpty: boolean } = { skipEmpty: true },
): string {
  return Object.keys(params)
    .filter((key) => key.startsWith('vnp_') && !HASH_FIELDS.has(key))
    .filter((key) => !options.skipEmpty || params[key] !== '')
    .sort()
    .map((key) => `${phpUrlEncode(key)}=${phpUrlEncode(params[key] ?? '')}`)
    .join('&');
}

export function signVnpayParams(params: Record<string, string>, secret: string) {
  const query = vnpayCanonicalQuery(params);
  return { query, secureHash: hmacSha512Hex(secret, query) };
}

export function verifyVnpayParams(
  params: Record<string, string>,
  secrets: readonly string[],
): boolean {
  const received = (params.vnp_SecureHash ?? '').toLowerCase();
  if (!received) return false;
  const canonicals = new Set([
    vnpayCanonicalQuery(params, { skipEmpty: true }),
    vnpayCanonicalQuery(params, { skipEmpty: false }),
  ]);
  return secrets.some((secret) =>
    [...canonicals].some((canonical) =>
      safeEqualString(hmacSha512Hex(secret, canonical), received),
    ),
  );
}

export function vnpayPipeHash(secret: string, values: readonly string[]): string {
  return hmacSha512Hex(secret, values.join('|'));
}

export function verifyVnpayPipeHash(
  secrets: readonly string[],
  values: readonly string[],
  received: string,
): boolean {
  const normalized = (received ?? '').toLowerCase();
  if (!normalized) return false;
  return secrets.some((secret) => safeEqualString(vnpayPipeHash(secret, values), normalized));
}
