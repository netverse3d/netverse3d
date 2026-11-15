import { createHmac } from 'crypto';
import { signPayload } from '@app/modules/shared/utils/signature.util';
import { safeEqualString } from '@app/modules/shared/utils/hash.util';

describe('signPayload', () => {
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ event: 'payment_intent.succeeded', total_minor: '150000' });

  it('khớp với vector HMAC-SHA256 chuẩn (RFC test vector)', () => {
    expect(signPayload('key', 'The quick brown fox jumps over the lazy dog')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });

  it('ký đúng secret + payload thì verify pass (so sánh hằng thời gian)', () => {
    const signature = signPayload(secret, payload);
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    expect(signature).toHaveLength(64);
    expect(safeEqualString(signature, expected)).toBe(true);
  });

  it('sai secret thì verify fail', () => {
    const signature = signPayload(secret, payload);
    const forged = signPayload('whsec_wrong_secret', payload);
    expect(safeEqualString(signature, forged)).toBe(false);
  });

  it('payload bị sửa thì verify fail', () => {
    const signature = signPayload(secret, payload);
    const tampered = signPayload(secret, payload.replace('150000', '1'));
    expect(safeEqualString(signature, tampered)).toBe(false);
  });
});
