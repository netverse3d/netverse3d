import assert from 'node:assert/strict';
import { test } from 'node:test';

import { STILL, clipFor, keysIntent, stickIntent, worldIntent } from './input.ts';
import type { LocalIntent } from './input.ts';

const DIAGONAL = Math.SQRT1_2;

function keys(...codes: string[]): LocalIntent {
  return keysIntent(new Set(codes));
}

function same(actual: { right: number; forward: number }, right: number, forward: number): void {
  assert.ok(Math.abs(actual.right - right) < 1e-9, `right ${actual.right} is not ${right}`);
  assert.ok(
    Math.abs(actual.forward - forward) < 1e-9,
    `forward ${actual.forward} is not ${forward}`,
  );
}

test('không có đầu vào thì đứng yên và phát clip idle', () => {
  assert.deepEqual(keys(), STILL);
  assert.deepEqual(stickIntent({ x: 0, y: 0 }), STILL);
  assert.equal(clipFor(worldIntent(STILL, 1.2)), 'idle');
});

test('W A S D và bốn phím mũi tên cho cùng bốn hướng', () => {
  same(keys('KeyW'), 0, 1);
  same(keys('KeyS'), 0, -1);
  same(keys('KeyD'), 1, 0);
  same(keys('KeyA'), -1, 0);
  assert.deepEqual(keys('ArrowUp'), keys('KeyW'));
  assert.deepEqual(keys('ArrowDown'), keys('KeyS'));
  assert.deepEqual(keys('ArrowRight'), keys('KeyD'));
  assert.deepEqual(keys('ArrowLeft'), keys('KeyA'));
});

test('đi chéo bằng hai phím không nhanh hơn đi thẳng', () => {
  same(keys('KeyW', 'KeyD'), DIAGONAL, DIAGONAL);
  same(keys('KeyW', 'ArrowUp', 'KeyD'), DIAGONAL, DIAGONAL);
});

test('hai phím ngược nhau triệt tiêu', () => {
  same(keys('KeyW', 'KeyS'), 0, 0);
  same(keys('KeyA', 'KeyD', 'KeyW'), 0, 1);
});

test('giữ Shift chuyển sang chạy, phím lạ bị bỏ qua', () => {
  assert.equal(keys('KeyW').run, false);
  assert.equal(keys('KeyW', 'ShiftLeft').run, true);
  assert.equal(keys('KeyW', 'ShiftRight').run, true);
  assert.deepEqual(keys('KeyQ', 'Space'), STILL);
});

test('giữ Shift mà không đi thì vẫn idle', () => {
  assert.equal(clipFor(worldIntent(keys('ShiftLeft'), 0)), 'idle');
});

test('cần ảo và phím ra cùng vector', () => {
  same(stickIntent({ x: 0, y: 1 }), keys('KeyW').right, keys('KeyW').forward);
  same(stickIntent({ x: -1, y: 0 }), keys('KeyA').right, keys('KeyA').forward);
  const corner = keys('KeyS', 'KeyD');
  same(stickIntent({ x: DIAGONAL, y: -DIAGONAL }), corner.right, corner.forward);
});

test('cần ảo đẩy quá vành được cắt về độ dài một', () => {
  same(stickIntent({ x: 3, y: 4 }), 0.6, 0.8);
});

test('cần ảo trong vùng chết thì đứng yên, vừa ra khỏi vùng chết thì đi rất chậm', () => {
  assert.deepEqual(stickIntent({ x: 0.1, y: -0.1 }), STILL);
  const nudge = stickIntent({ x: 0, y: 0.2 });
  assert.ok(nudge.forward > 0 && nudge.forward < 0.1, `nudge moved ${nudge.forward}`);
});

test('cần ảo đẩy gần hết vành thì chạy, đẩy lưng chừng thì đi bộ', () => {
  assert.equal(stickIntent({ x: 0, y: 0.5 }).run, false);
  assert.equal(stickIntent({ x: 0, y: 0.95 }).run, true);
  assert.equal(stickIntent({ x: 0.7, y: 0.7 }).run, true);
});

test('số đo hỏng từ cần ảo được coi là không chạm', () => {
  assert.deepEqual(stickIntent({ x: Number.NaN, y: 1 }), STILL);
  assert.deepEqual(stickIntent({ x: 0, y: Infinity }), STILL);
});

test('tiến là đi theo hướng camera đang nhìn, phải là bên tay phải của camera', () => {
  const ahead = worldIntent({ right: 0, forward: 1, run: false }, 0);
  assert.ok(Math.abs(ahead.x) < 1e-9 && Math.abs(ahead.z - 1) < 1e-9);
  const side = worldIntent({ right: 1, forward: 0, run: false }, 0);
  assert.ok(Math.abs(side.x + 1) < 1e-9 && Math.abs(side.z) < 1e-9);
  const east = worldIntent({ right: 0, forward: 1, run: true }, Math.PI / 2);
  assert.ok(Math.abs(east.x - 1) < 1e-9 && Math.abs(east.z) < 1e-9);
  assert.equal(east.run, true);
  const eastSide = worldIntent({ right: 1, forward: 0, run: false }, Math.PI / 2);
  assert.ok(Math.abs(eastSide.x) < 1e-9 && Math.abs(eastSide.z - 1) < 1e-9);
});

test('clip theo ý định: đứng thì idle, đi thì walk, chạy thì run', () => {
  assert.equal(clipFor({ x: 0, z: 0, run: true }), 'idle');
  assert.equal(clipFor({ x: 0.4, z: 0, run: false }), 'walk');
  assert.equal(clipFor({ x: 0, z: -1, run: true }), 'run');
});
