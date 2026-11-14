import { randomBytes } from 'crypto';
import {
  ProviderCredentialCipher,
  parseKeyring,
} from '@app/infrastructure/secrets/provider-credential-crypto.service';

const key = () => randomBytes(32).toString('base64');

describe('ProviderCredentialCipher — AES-256-GCM', () => {
  const credentials = { hash_secret: 'x'.repeat(16), tmn_code: 'DEMO0001' };

  it('mã hoá rồi giải mã đúng, ciphertext không chứa plaintext', () => {
    const cipher = new ProviderCredentialCipher(`1:${key()}`);
    const encrypted = cipher.encrypt(credentials, 'provider_account:a1');

    expect(encrypted.keyVersion).toBe(1);
    expect(Buffer.from(encrypted.ciphertext, 'base64').toString('utf8')).not.toContain(
      'VNPAY_SECRET_123',
    );
    expect(cipher.decrypt(encrypted, 'provider_account:a1')).toEqual(credentials);
  });

  it('IV ngẫu nhiên: hai lần mã hoá cùng plaintext ra ciphertext khác nhau', () => {
    const cipher = new ProviderCredentialCipher(`1:${key()}`);
    expect(cipher.encrypt(credentials, 'a').ciphertext).not.toBe(
      cipher.encrypt(credentials, 'a').ciphertext,
    );
  });

  it('AAD khác (copy ciphertext sang account khác) -> giải mã thất bại', () => {
    const cipher = new ProviderCredentialCipher(`1:${key()}`);
    const encrypted = cipher.encrypt(credentials, 'provider_account:a1');

    expect(() => cipher.decrypt(encrypted, 'provider_account:a2')).toThrow(
      'could not be decrypted',
    );
  });

  it('ciphertext bị sửa -> giải mã thất bại (GCM auth tag)', () => {
    const cipher = new ProviderCredentialCipher(`1:${key()}`);
    const encrypted = cipher.encrypt(credentials, 'aad');
    const tampered = Buffer.from(encrypted.ciphertext, 'base64');
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;

    expect(() =>
      cipher.decrypt({ ...encrypted, ciphertext: tampered.toString('base64') }, 'aad'),
    ).toThrow('could not be decrypted');
  });

  it('xoay key: mã hoá bằng version mới nhất, vẫn giải mã được row cũ theo version lưu trên row', () => {
    const k1 = key();
    const old = new ProviderCredentialCipher(`1:${k1}`).encrypt(credentials, 'aad');
    const rotated = new ProviderCredentialCipher(`1:${k1},2:${key()}`);

    expect(rotated.encrypt(credentials, 'aad').keyVersion).toBe(2);
    expect(rotated.decrypt(old, 'aad')).toEqual(credentials);
  });

  it('active version chỉ định rõ phải tồn tại trong keyring', () => {
    expect(
      new ProviderCredentialCipher(`1:${key()},2:${key()}`, '1').encrypt(credentials, 'a')
        .keyVersion,
    ).toBe(1);
    expect(() => new ProviderCredentialCipher(`1:${key()}`, '3').encrypt(credentials, 'a')).toThrow(
      'has no key',
    );
  });

  it('chưa cấu hình keyring -> isConfigured false, encrypt từ chối', () => {
    const cipher = new ProviderCredentialCipher('');
    expect(cipher.isConfigured()).toBe(false);
    expect(() => cipher.encrypt(credentials, 'a')).toThrow('not configured');
  });

  it('keyring sai định dạng / key không đủ 32 byte -> throw', () => {
    expect(() => parseKeyring('abc')).toThrow();
    expect(() => parseKeyring(`0:${key()}`)).toThrow();
    expect(() => parseKeyring(`1:${randomBytes(16).toString('base64')}`)).toThrow('32 bytes');
    expect(() => parseKeyring(`1:${key()},1:${key()}`)).toThrow('duplicate');
  });
});
