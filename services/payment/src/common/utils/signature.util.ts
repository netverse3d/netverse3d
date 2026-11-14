import { createHmac } from 'crypto';
import { safeEqualString } from './hash.util';

export function signPayload(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyPayloadSignature(secret: string, payload: string, signature: string) {
  return safeEqualString(signPayload(secret, payload), signature);
}
