import { openSecret, sealSecret } from '../../../../../src/modules/keys/domain/secret-box';

const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

describe('mã hoá khoá ký', () => {
  it('mở lại đúng nội dung đã niêm phong', () => {
    expect(openSecret(sealSecret('private key', KEY), KEY)).toBe('private key');
  });

  it('mỗi lần niêm phong cho kết quả khác nhau', () => {
    expect(sealSecret('same', KEY)).not.toBe(sealSecret('same', KEY));
  });

  it('không mở được bằng khoá khác', () => {
    expect(() => openSecret(sealSecret('private key', KEY), OTHER_KEY)).toThrow();
  });

  it('từ chối chuỗi không đủ ba phần', () => {
    expect(() => openSecret('only-one-part', KEY)).toThrow('Sealed secret is malformed');
  });

  it('phát hiện dữ liệu bị sửa', () => {
    const [iv, tag, data = ''] = sealSecret('private key', KEY).split('.');
    const tampered = `${iv}.${tag}.${data.slice(0, -2)}${data.endsWith('00') ? '11' : '00'}`;
    expect(() => openSecret(tampered, KEY)).toThrow();
  });
});
