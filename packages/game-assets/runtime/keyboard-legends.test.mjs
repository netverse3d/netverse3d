import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { keyboardCatalog } from '../tools/keyboards.mjs';
import {
  keyRects,
  keycapColor,
  ledColor,
  legendColor,
  legendTextures,
  paintEmissive,
  paintLegends,
} from './keyboard-legends.mjs';
import { COLORWAYS, LED_MODES, keyboardOptions, zoneOf } from './keyboard-styles.mjs';

const CATALOG = keyboardCatalog();
const NEON = { palette: { keycap: ['#000000', '#ffffff'], strip: ['#a835ff'] } };
const RETRO = { palette: NEON.palette, keyboard: { colorway: 'retro', led: 'white' } };

function recordingContext() {
  const calls = { fillText: [], fill: 0, rects: 0 };
  const noop = () => {};
  return {
    calls,
    fillRect: () => {
      calls.rects += 1;
    },
    beginPath: noop,
    moveTo: noop,
    arcTo: noop,
    closePath: noop,
    stroke: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    fill: () => {
      calls.fill += 1;
    },
    strokeText: noop,
    fillText: (text, x, y) => calls.fillText.push({ text, x, y }),
  };
}

const totalKeys = CATALOG.layouts.reduce((sum, layout) => sum + layout.keys.length, 0);
const legendLines = CATALOG.layouts
  .flatMap((layout) => layout.keys)
  .reduce((sum, key) => sum + (key.label === 'Space' ? 0 : key.shift ? 2 : 1), 0);

test('mỗi phím có một ô trong atlas, ô nằm đúng dải của bố cục', () => {
  const rects = keyRects(CATALOG);
  assert.equal(rects.length, totalKeys);
  for (const rect of rects) {
    const strip = CATALOG.atlas.strips.find((entry) => entry.id === rect.layout.id);
    assert.ok(
      rect.y >= strip.y - 1e-6 && rect.y + rect.h <= strip.y + strip.height + 1e-6,
      rect.key.code,
    );
    assert.ok(rect.x >= 0 && rect.x + rect.w <= CATALOG.atlas.width + 1e-6, rect.key.code);
  }
});

test('bộ màu neon lấy dải keycap của công thức, bộ màu cố định tô theo vùng phím', () => {
  const layout = CATALOG.layouts[0];
  const left = layout.keys.find((key) => key.code === 'Backquote');
  const right = layout.keys.find((key) => key.code === 'Backspace');
  assert.ok(keycapColor(NEON, layout, left)[0] < 80);
  assert.ok(keycapColor(NEON, layout, right)[0] > 180);
  const letter = layout.keys.find((key) => key.code === 'KeyQ');
  const shift = layout.keys.find((key) => key.code === 'ShiftLeft');
  const enter = layout.keys.find((key) => key.code === 'Enter');
  assert.deepEqual(keycapColor(RETRO, layout, letter), [0xef, 0xe6, 0xd6]);
  assert.deepEqual(keycapColor(RETRO, layout, shift), [0x8e, 0x90, 0x99]);
  assert.deepEqual(keycapColor(RETRO, layout, enter), [0xd9, 0xa4, 0x41]);
  assert.equal(legendColor([0, 0, 0]), '#f4f2ff');
  assert.equal(legendColor([240, 240, 240]), '#1a1626');
  assert.equal(legendColor([0, 0, 0], RETRO), COLORWAYS.retro.legend);
});

test('chế độ LED cho màu theo phím, một màu theo dải sáng, trắng hoặc tắt', () => {
  const layout = CATALOG.layouts[0];
  const key = layout.keys.find((entry) => entry.code === 'KeyA');
  assert.equal(ledColor(NEON, layout, key).length, 3);
  assert.deepEqual(ledColor(RETRO, layout, key), [255, 255, 255]);
  assert.deepEqual(
    ledColor({ ...NEON, keyboard: { led: 'single' } }, layout, key),
    [0xa8, 0x35, 0xff],
  );
  assert.equal(ledColor({ ...NEON, keyboard: { led: 'off' } }, layout, key), null);
  assert.deepEqual(keyboardOptions({ keyboard: { colorway: 'nope', led: 'nope' } }), {
    colorway: 'neon',
    led: 'rainbow',
  });
  assert.ok(Object.keys(LED_MODES).includes('rainbow'));
  assert.equal(zoneOf({ code: 'ArrowLeft' }), 'accent');
});

test('vẽ atlas ghi chữ cho mọi phím trừ phím cách, phím có shift ghi hai dòng', () => {
  const ctx = recordingContext();
  paintLegends(ctx, CATALOG, NEON);
  assert.equal(ctx.calls.fillText.length, legendLines);
  assert.ok(ctx.calls.fillText.some((call) => call.text === '@'));
  assert.ok(ctx.calls.fillText.some((call) => call.text === 'Enter'));
});

test('lớp phát sáng ghi chữ theo màu LED và bỏ trống khi LED tắt', () => {
  const lit = recordingContext();
  paintEmissive(lit, CATALOG, NEON);
  assert.equal(lit.calls.fillText.length, legendLines);
  assert.equal(lit.calls.rects, 1 + totalKeys);
  const off = recordingContext();
  paintEmissive(off, CATALOG, { ...NEON, keyboard: { led: 'off' } });
  assert.equal(off.calls.fillText.length, 0);
  assert.equal(off.calls.rects, 1);
});

test('legendTextures trả hai ảnh không lật, dùng canvas được tiêm vào', () => {
  const canvases = [];
  const createCanvas = () => {
    const canvas = { width: 0, height: 0, getContext: () => recordingContext() };
    canvases.push(canvas);
    return canvas;
  };
  const textures = legendTextures(THREE, CATALOG, RETRO, { createCanvas });
  assert.equal(canvases.length, 2);
  assert.equal(canvases[0].width, CATALOG.atlas.width);
  assert.equal(canvases[1].height, CATALOG.atlas.height);
  assert.equal(textures.map.flipY, false);
  assert.equal(textures.emissive.colorSpace, THREE.SRGBColorSpace);
});
