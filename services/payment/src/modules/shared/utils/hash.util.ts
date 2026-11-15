import { createHash, timingSafeEqual } from 'crypto';

export function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export function safeEqualString(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
