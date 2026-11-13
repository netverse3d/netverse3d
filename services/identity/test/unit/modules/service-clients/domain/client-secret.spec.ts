import {
  hashClientSecret,
  matchesClientSecret,
  newClientSecret,
} from '../../../../../src/modules/service-clients/domain/client-secret';

describe('khoá bí mật của tài khoản service', () => {
  it('mỗi khoá mới khác nhau và đủ dài để không đoán được', () => {
    const first = newClientSecret();
    expect(first).not.toBe(newClientSecret());
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
  });

  it('khoá đúng khớp với bản băm đã lưu', () => {
    const secret = newClientSecret();
    expect(matchesClientSecret(secret, hashClientSecret(secret))).toBe(true);
  });

  it('khoá sai, khoá rỗng và bản băm hỏng đều không khớp', () => {
    const stored = hashClientSecret(newClientSecret());
    expect(matchesClientSecret(newClientSecret(), stored)).toBe(false);
    expect(matchesClientSecret('', stored)).toBe(false);
    expect(matchesClientSecret(newClientSecret(), 'not-a-hash')).toBe(false);
  });

  it('bản băm không chứa khoá gốc', () => {
    const secret = newClientSecret();
    expect(hashClientSecret(secret)).not.toContain(secret);
  });
});
