import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio, parseColor } from '../../src/contrast.mjs';

test('trắng trên đen có tương phản 21:1', () => {
  assert.equal(Math.round(contrastRatio('#ffffff', '#000000')), 21);
});

test('màu nền trong suốt được tính ở trường hợp xấu nhất trên nền đen và nền trắng', () => {
  const opaque = contrastRatio('#ffffff', '#202020');
  const translucent = contrastRatio('#ffffff', '#20202080');
  assert.ok(translucent < opaque);
});

test('đọc được mã màu ba, sáu và tám chữ số', () => {
  assert.deepEqual(parseColor('#fff'), { rgb: [255, 255, 255], alpha: 1 });
  assert.deepEqual(parseColor('#00000080').rgb, [0, 0, 0]);
  assert.ok(Math.abs(parseColor('#00000080').alpha - 128 / 255) < 1e-9);
});
