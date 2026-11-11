import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { atlasOf, keyboardCatalog, keyboardLayouts, layoutProblems } from './keyboards.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('năm bố cục ANSI có đúng số phím và không phím nào chồng hay lọt ra ngoài bàn', () => {
  const counts = Object.fromEntries(
    keyboardLayouts().map((layout) => [layout.id, layout.keys.length]),
  );
  assert.deepEqual(counts, {
    'ansi-60': 61,
    'ansi-tkl': 87,
    'ansi-75': 82,
    'ansi-65': 68,
    'ansi-100': 104,
  });
  for (const layout of keyboardLayouts()) assert.deepEqual(layoutProblems(layout), []);
});

test('mỗi hàng của khối chính rộng đúng 15 đơn vị', () => {
  const layout = keyboardLayouts().find((entry) => entry.id === 'ansi-60');
  for (let y = 0; y < 5; y += 1) {
    const width = layout.keys.filter((key) => key.y === y).reduce((sum, key) => sum + key.w, 0);
    assert.equal(width, 15, `row ${y}`);
  }
});

test('phím có mã KeyboardEvent.code, ký tự shift chuẩn Mỹ và vùng màu', () => {
  const keys = Object.fromEntries(
    keyboardLayouts()
      .find((entry) => entry.id === 'ansi-100')
      .keys.map((key) => [key.code, key]),
  );
  assert.equal(keys.KeyQ.label, 'Q');
  assert.equal(keys.Digit2.shift, '@');
  assert.equal(keys.Semicolon.shift, ':');
  assert.equal(keys.ShiftRight.w, 2.75);
  assert.equal(keys.Space.w, 6.25);
  assert.equal(keys.ArrowUp.x, 16.25);
  assert.equal(keys.NumpadAdd.h, 2);
  assert.equal(keys.Numpad0.w, 2);
  assert.equal(keys.Numpad7.shift, null);
  assert.equal(keys.KeyQ.zone, 'alpha');
  assert.equal(keys.ShiftLeft.zone, 'mod');
  assert.equal(keys.Enter.zone, 'accent');
  assert.equal(keys.Escape.zone, 'accent');
});

test('atlas xếp các bố cục thành dải chồng nhau và khai cột màu thân phím', () => {
  const atlas = atlasOf(keyboardLayouts(), 2048);
  assert.equal(atlas.strips[0].y, 0);
  assert.equal(atlas.strips[0].height, Math.round((2048 * 5) / 15));
  assert.equal(atlas.strips[1].y, atlas.strips[0].height);
  assert.equal(
    atlas.height,
    atlas.strips.reduce((sum, strip) => sum + strip.height, 0),
  );
  assert.ok(atlas.sideColumn.x1 > atlas.sideColumn.x0 && atlas.sideColumn.x1 < 0.3);
});

test('keyboards.json trong repo khớp với bộ sinh', () => {
  const stored = JSON.parse(readFileSync(join(ROOT, 'keyboards.json'), 'utf8'));
  assert.deepEqual(stored, keyboardCatalog());
});
