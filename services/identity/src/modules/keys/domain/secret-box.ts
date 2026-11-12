import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;

export function sealSecret(plain: string, hexKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(
    '.',
  );
}

export function openSecret(sealed: string, hexKey: string): string {
  const [iv, tag, data] = sealed.split('.');
  if (iv === undefined || tag === undefined || data === undefined) {
    throw new Error('Sealed secret is malformed');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(hexKey, 'hex'),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
