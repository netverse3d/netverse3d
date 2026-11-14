import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { AppConfig } from '@app/config/app-config';

export interface EncryptedCredentials {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export class ProviderCredentialCipher {
  private keyring: Map<number, Buffer> | null = null;

  constructor(
    private readonly rawKeys: string,
    private readonly rawActiveVersion: string = '',
  ) {}

  isConfigured() {
    return this.keys().size > 0;
  }

  encrypt(plaintext: Record<string, unknown>, aad: string): EncryptedCredentials {
    const keyVersion = this.activeVersion();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key(keyVersion), iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(plaintext), 'utf8'),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      keyVersion,
    };
  }

  decrypt(encrypted: EncryptedCredentials, aad: string): Record<string, unknown> {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key(encrypted.keyVersion),
      Buffer.from(encrypted.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    let plaintext: string;
    try {
      plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        'Provider credentials could not be decrypted (wrong key version, tampered data or AAD mismatch)',
      );
    }
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Provider credentials plaintext is not an object');
    }
    return parsed as Record<string, unknown>;
  }

  private activeVersion() {
    const keys = this.keys();
    if (keys.size === 0) {
      throw new Error(
        'PROVIDER_CREDENTIALS_KEYS is not configured — refusing to handle provider secrets',
      );
    }
    if (this.rawActiveVersion.trim()) {
      const version = Number(this.rawActiveVersion);
      if (!keys.has(version))
        throw new Error(
          `PROVIDER_CREDENTIALS_ACTIVE_KEY_VERSION=${version} has no key in PROVIDER_CREDENTIALS_KEYS`,
        );
      return version;
    }
    return Math.max(...keys.keys());
  }

  private key(version: number) {
    const key = this.keys().get(version);
    if (!key) throw new Error(`Provider credential key version ${version} is not configured`);
    return key;
  }

  private keys() {
    if (!this.keyring) this.keyring = parseKeyring(this.rawKeys);
    return this.keyring;
  }
}

@Injectable()
export class ProviderCredentialCryptoService extends ProviderCredentialCipher {
  constructor(config: AppConfig) {
    super(config.payment.providerCredentialKeys, config.payment.providerCredentialActiveKeyVersion);
  }
}

export function parseKeyring(raw: string): Map<number, Buffer> {
  const keyring = new Map<number, Buffer>();
  for (const entry of raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const separator = entry.indexOf(':');
    const version = Number(entry.slice(0, separator));
    const key = Buffer.from(entry.slice(separator + 1), 'base64');
    if (separator <= 0 || !Number.isInteger(version) || version <= 0) {
      throw new Error('PROVIDER_CREDENTIALS_KEYS entry must look like <version>:<base64 key>');
    }
    if (key.length !== 32) {
      throw new Error(
        `PROVIDER_CREDENTIALS_KEYS version ${version} must decode to exactly 32 bytes`,
      );
    }
    if (keyring.has(version))
      throw new Error(`PROVIDER_CREDENTIALS_KEYS has duplicate version ${version}`);
    keyring.set(version, key);
  }
  return keyring;
}
