import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYER_RADIUS, stepPlayer } from '@netverse/game-shared/movement';

import {
  WALL_MODEL_DEPTH,
  WALL_THICKNESS,
  shopInterior,
  shopOpenFloor,
  shopPerimeter,
} from './shop-bounds.ts';

test('lòng tiệm là phần sàn nằm trong mặt trong của bốn tường', () => {
  assert.deepEqual(shopInterior([4, 3]), {
    minX: -4 + WALL_THICKNESS,
    maxX: 4 - WALL_THICKNESS,
    minZ: -3 + WALL_THICKNESS,
    maxZ: 3 - WALL_THICKNESS,
  });
});

test('vành ngoài chặn người chơi ở ngay ngưỡng cửa theo cả bốn phía, kể cả khi tường có ô trống', () => {
  const perimeter = shopPerimeter([4, 3]);
  const walks = [
    { intent: { x: 0, z: 1 }, edge: (x: number, z: number) => z, limit: 3 },
    { intent: { x: 0, z: -1 }, edge: (x: number, z: number) => -z, limit: 3 },
    { intent: { x: 1, z: 0 }, edge: (x: number) => x, limit: 4 },
    { intent: { x: -1, z: 0 }, edge: (x: number) => -x, limit: 4 },
  ];
  for (const { intent, edge, limit } of walks) {
    let player = { x: 0.5, z: -0.5, yaw: 0 };
    for (let tick = 0; tick < 300; tick += 1) {
      player = stepPlayer(player, intent, perimeter, 1 / 30);
    }
    const reached = edge(player.x, player.z);
    assert.ok(Math.abs(reached - (limit - PLAYER_RADIUS)) < 1e-6, `stopped at ${reached}`);
  }
});

test('vành ngoài không lấn vào lòng tiệm', () => {
  const interior = shopInterior([2, 2]);
  for (const box of shopPerimeter([2, 2])) {
    const overlapsX = box.minX < interior.maxX && box.maxX > interior.minX;
    const overlapsZ = box.minZ < interior.maxZ && box.maxZ > interior.minZ;
    assert.equal(overlapsX && overlapsZ, false);
  }
});

test('vành ngoài kín cả ở bốn góc', () => {
  const perimeter = shopPerimeter([2, 2]);
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    let player = { x: 0, z: 0, yaw: 0 };
    for (let tick = 0; tick < 300; tick += 1) {
      player = stepPlayer(player, { x, z }, perimeter, 1 / 30);
    }
    assert.ok(
      Math.abs(player.x) <= 2 && Math.abs(player.z) <= 2,
      `escaped to ${player.x},${player.z}`,
    );
  }
});

test('phần sàn trống nằm trong cả bề dày hình vẽ của tường, hẹp hơn lòng tiệm', () => {
  const open = shopOpenFloor([4, 3]);
  const interior = shopInterior([4, 3]);
  assert.deepEqual(open, {
    minX: -4 + WALL_MODEL_DEPTH,
    maxX: 4 - WALL_MODEL_DEPTH,
    minZ: -3 + WALL_MODEL_DEPTH,
    maxZ: 3 - WALL_MODEL_DEPTH,
  });
  assert.ok(open.maxX < interior.maxX && open.maxZ < interior.maxZ);
});
