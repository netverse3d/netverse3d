import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { ValidateBy, ValidationOptions } from 'class-validator';

export interface ResolvedWebhookAddress {
  address: string;
  family: 4 | 6;
}

export class UnsafeWebhookTargetError extends Error {}

export function IsPublicHttpsWebhookUrl(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isPublicHttpsWebhookUrl',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isAllowedWebhookUrl(value),
        defaultMessage: () => 'url must be a public HTTPS endpoint',
      },
    },
    options,
  );
}

export function isAllowedWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== '443')
    ) {
      return false;
    }
    const hostname = normalizeHostname(url.hostname);
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.test')
    ) {
      return false;
    }
    return isIP(hostname) === 0 || isPublicIpAddress(hostname);
  } catch {
    return false;
  }
}

export async function resolveWebhookTarget(
  hostnameValue: string,
  allowLoopback = false,
): Promise<ResolvedWebhookAddress[]> {
  const hostname = normalizeHostname(hostnameValue);
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(
      ({ address }) =>
        !isPublicIpAddress(address) && !(allowLoopback && isLoopbackAddress(address)),
    )
  ) {
    throw new UnsafeWebhookTargetError('Webhook target resolves to a non-public address');
  }
  return addresses.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIpv4(address);
  if (version !== 6) return false;
  const groups = expandIpv6(address);
  if (!groups) return false;
  const first = groups[0];
  const second = groups[1];
  if (first === undefined || second === undefined) return false;
  if (first < 0x2000 || first > 0x3fff) return false;
  if ((first === 0x2001 && second <= 0x01ff) || (first === 0x2001 && second === 0x0db8)) {
    return false;
  }
  if (first === 0x2002) return false;
  if (first === 0x3fff && second <= 0x0fff) return false;
  return true;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [first, second, third] = octets;
  if (
    octets.length !== 4 ||
    first === undefined ||
    second === undefined ||
    third === undefined ||
    octets.some((octet) => octet < 0 || octet > 255)
  ) {
    return false;
  }
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 0 && (third === 0 || third === 2)) return false;
  if (first === 192 && second === 168) return false;
  if (first === 192 && second === 88 && third === 99) return false;
  if (first === 198 && (second === 18 || second === 19)) return false;
  if (first === 198 && second === 51 && third === 100) return false;
  if (first === 203 && second === 0 && third === 113) return false;
  return true;
}

export function isLoopbackAddress(address: string): boolean {
  if (isIP(address) === 4) return address.startsWith('127.');
  return address.toLowerCase() === '::1';
}

function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

function expandIpv6(address: string): number[] | null {
  const value = address.toLowerCase().split('%')[0] ?? '';
  const parts = value.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const zeroCount = 8 - left.length - right.length;
  if ((parts.length === 1 && zeroCount !== 0) || (parts.length === 2 && zeroCount < 1)) return null;
  const groups = [...left, ...Array(zeroCount).fill('0'), ...right].map((part) =>
    parseInt(part, 16),
  );
  return groups.length === 8 && groups.every((group) => Number.isInteger(group)) ? groups : null;
}
