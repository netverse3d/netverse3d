import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { keyboardCatalog } from '../tools/keyboards.mjs';
import {
  keyRects,
  keycapColor,
  legendColor,
  legendTexture,
  paintLegends,
} from './keyboard-legends.mjs';

const CATALOG = keyboardCatalog();
const RECIPE = { palette: { keycap: ['#000000', '#ffffff'] } };

function recordingContext() {
  const calls = { fillText: [], fill: 0 };
  const noop = () => {};
  return {
    calls,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    fill: () => {
      calls.fill += 1;
    },
    strokeText: noop,
    fillText: (text, x, y) => calls.fillText.push({ text, x, y }),
  };
}

test('mỗi phím có một ô trong atlas, ô nằm đúng dải của bố cục', () => {
  const rects = keyRects(CATALOG);
  const total = CATALOG.layouts.reduce((sum, layout) => sum + layout.keys.length, 0);
  assert.equal(rects.length, total);
  for (const rect of rects) {
    const strip = CATALOG.atlas.strips.find((entry) => entry.id === rect.layout.id);
    assert.ok(
      rect.y >= strip.y - 1e-6 && rect.y + rect.h <= strip.y + strip.height + 1e-6,
      rect.key.code,
    );
    assert.ok(rect.x >= 0 && rect.x + rect.w <= CATALOG.atlas.width + 1e-6, rect.key.code);
  }
});

test('màu phím lấy theo dải màu keycap của công thức và chữ đổi tương phản', () => {
  const layout = CATALOG.layouts[0];
  const left = layout.keys.find((key) => key.code === 'Backquote');
  const right = layout.keys.find((key) => key.code === 'Backspace');
  assert.ok(keycapColor(RECIPE, layout, left)[0] < 80);
  assert.ok(keycapColor(RECIPE, layout, right)[0] > 180);
  assert.equal(legendColor([0, 0, 0]), '#f4f2ff');
  assert.equal(legendColor([240, 240, 240]), '#1a1626');
});

test('vẽ atlas ghi chữ cho mọi phím trừ phím cách, phím có shift ghi hai dòng', () => {
  const ctx = recordingContext();
  paintLegends(ctx, CATALOG, RECIPE);
  const expected = CATALOG.layouts
    .flatMap((layout) => layout.keys)
    .reduce((sum, key) => sum + (key.label === 'Space' ? 0 : key.shift ? 2 : 1), 0);
  assert.equal(ctx.calls.fillText.length, expected);
  assert.ok(ctx.calls.fillText.some((call) => call.text === '@'));
  assert.ok(ctx.calls.fillText.some((call) => call.text === 'Enter'));
});

test('legendTexture dùng canvas được tiêm vào và không lật ảnh', () => {
  const ctx = recordingContext();
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const texture = legendTexture(THREE, CATALOG, RECIPE, { createCanvas: () => canvas });
  assert.equal(canvas.width, CATALOG.atlas.width);
  assert.equal(canvas.height, CATALOG.atlas.height);
  assert.equal(texture.flipY, false);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
});
