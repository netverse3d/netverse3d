import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ranh giới cấu trúc payment', () => {
  it('dùng health module từ NestKit thay vì giữ module cục bộ', () => {
    const localHealthModule = resolve(__dirname, '../../../src/modules/health');

    expect(existsSync(localHealthModule)).toBe(false);
  });
});
