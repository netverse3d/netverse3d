import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SECRET_BYTES = 32;

export function newClientSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

export function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function matchesClientSecret(presented: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashClientSecret(presented), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
