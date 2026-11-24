import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readableAccent } from '../../src/accent.mjs';
import { contrastRatio } from '../../src/contrast.mjs';

const backgrounds = ['#1a1530', '#252038'];

test('accent tối của tiệm được làm sáng tới khi đạt 3:1 trên mọi mặt nền', () => {
  const accent = readableAccent('#8a2bff', backgrounds);
  for (const background of backgrounds) assert.ok(contrastRatio(accent, background) >= 3);
});

test('accent đã đủ tương phản thì giữ nguyên', () => {
  assert.equal(readableAccent('#22e0c0', backgrounds), '#22e0c0');
});

test('accent không đọc được thì trả về null', () => {
  assert.equal(readableAccent('tím', backgrounds), null);
});
