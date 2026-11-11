import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYER_RADIUS } from './movement.ts';
import { SEAT_REACH, gapToBox, seatIdOf, withinSeatReach } from './seating.ts';

const BOX = { minX: -1, maxX: 1, minZ: -0.5, maxZ: 0.5 };

function close(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} is not ${expected}`);
}

test('tên máy đếm từ một theo thứ tự cụm máy trong tiệm', () => {
  assert.equal(seatIdOf(0), 'seat-1');
  assert.equal(seatIdOf(9), 'seat-10');
});

test('thứ tự cụm máy không phải số nguyên không âm thì báo lỗi', () => {
  for (const station of [-1, 0.5, Number.NaN, Infinity]) {
    assert.throws(() => seatIdOf(station), TypeError, String(station));
  }
});

test('khoảng hở tới một hộp bằng không khi đứng trong hộp, đo thẳng ra cạnh, đo chéo ra góc', () => {
  close(gapToBox(BOX, { x: 0.3, z: -0.2 }), 0, 'inside');
  close(gapToBox(BOX, { x: 1.4, z: 0 }), 0.4, 'east');
  close(gapToBox(BOX, { x: -1.25, z: 0.1 }), 0.25, 'west');
  close(gapToBox(BOX, { x: 0, z: 0.8 }), 0.3, 'south');
  close(gapToBox(BOX, { x: 0, z: -1.5 }), 1, 'north');
  close(gapToBox(BOX, { x: 1.3, z: 0.9 }), 0.5, 'corner');
});

test('tầm với tới máy là thân người cộng hai mươi phân', () => {
  assert.equal(SEAT_REACH, PLAYER_RADIUS + 0.2);
});

test('đứng chạm cụm máy là trong tầm, lùi quá một bước ngắn là ngoài tầm', () => {
  assert.equal(withinSeatReach({ x: 1 + PLAYER_RADIUS, z: 0 }, BOX), true);
  assert.equal(withinSeatReach({ x: 1 + SEAT_REACH - 0.001, z: 0 }, BOX), true);
  assert.equal(withinSeatReach({ x: 1 + SEAT_REACH + 0.001, z: 0 }, BOX), false);
  assert.equal(withinSeatReach({ x: 1 + 0.4, z: 0.5 + 0.4 }, BOX), false);
});

test('vị trí hỏng thì coi là ngoài tầm', () => {
  assert.equal(withinSeatReach({ x: Number.NaN, z: 0 }, BOX), false);
  assert.equal(withinSeatReach({ x: 0, z: Infinity }, BOX), false);
});
