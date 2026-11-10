import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYER_RADIUS, RUN_SPEED, WALK_SPEED } from '@netverse/game-shared/movement';
import { TICK_SECONDS } from '@netverse/game-shared/simulation';

import { STILL } from './input.ts';
import type { LocalIntent } from './input.ts';
import { createWalk } from './walk.ts';
import type { WalkFrame } from './walk.ts';

const AHEAD: LocalIntent = { right: 0, forward: 1, run: false };
const SPRINT: LocalIntent = { right: 0, forward: 1, run: true };
const START = { x: 0, z: 0, yaw: 0 };
const WALL = [{ minX: -5, maxX: 5, minZ: 2, maxZ: 2.2 }];

function play(
  framesPerSecond: number,
  seconds: number,
  intent: LocalIntent,
  cameraYaw = 0,
  obstacles = WALL,
): WalkFrame {
  const walk = createWalk(START, obstacles);
  let frame = walk.advance(0, STILL, cameraYaw);
  for (let index = 0; index < framesPerSecond * seconds; index += 1) {
    frame = walk.advance(1 / framesPerSecond, intent, cameraYaw);
  }
  return frame;
}

test('đứng yên thì ở nguyên chỗ xuất hiện và phát idle', () => {
  const frame = play(60, 1, STILL);
  assert.deepEqual(frame.player, START);
  assert.equal(frame.clip, 'idle');
});

test('đi một giây về phía camera nhìn được quãng bằng tốc độ đi bộ, phát walk', () => {
  const frame = play(60, 1, AHEAD, Math.PI / 2, []);
  assert.ok(Math.abs(frame.player.x - WALK_SPEED) < 0.1, `walked to x ${frame.player.x}`);
  assert.ok(Math.abs(frame.player.z) < 1e-9, `drifted to z ${frame.player.z}`);
  assert.ok(Math.abs(frame.player.yaw - Math.PI / 2) < 1e-9, `faces ${frame.player.yaw}`);
  assert.equal(frame.clip, 'walk');
});

test('giữ chạy thì đi nhanh hơn và phát run', () => {
  const frame = play(60, 0.4, SPRINT, 0, []);
  assert.ok(Math.abs(frame.player.z - RUN_SPEED * 0.4) < 0.2, `ran to z ${frame.player.z}`);
  assert.equal(frame.clip, 'run');
});

test('tường chặn nhân vật ở đúng mép dù vẫn giữ phím đi', () => {
  const frame = play(60, 4, AHEAD);
  assert.ok(Math.abs(frame.player.z - (2 - PLAYER_RADIUS)) < 1e-6, `stopped at ${frame.player.z}`);
  assert.equal(frame.clip, 'walk');
});

test('máy 20, 60 và 144 khung hình mỗi giây đi cùng một quãng sau cùng thời gian', () => {
  const slow = play(20, 0.5, AHEAD, 0.7, []);
  const usual = play(60, 0.5, AHEAD, 0.7, []);
  const fast = play(144, 0.5, AHEAD, 0.7, []);
  const step = WALK_SPEED * TICK_SECONDS;
  for (const other of [usual, fast]) {
    assert.ok(Math.abs(other.player.x - slow.player.x) <= step, `x ${other.player.x}`);
    assert.ok(Math.abs(other.player.z - slow.player.z) <= step, `z ${other.player.z}`);
  }
});

test('khung hình rơi giữa hai nhịp thì vị trí vẽ nằm giữa hai nhịp đó', () => {
  const walk = createWalk(START, []);
  walk.advance(TICK_SECONDS, AHEAD, 0);
  const between = walk.advance(TICK_SECONDS / 2, AHEAD, 0);
  const step = WALK_SPEED * TICK_SECONDS;
  assert.ok(between.player.z > 0 && between.player.z < step, `drawn at ${between.player.z}`);
});

test('đặt lại chỗ đứng thì nhân vật hiện ngay ở chỗ mới, không trượt từ chỗ cũ', () => {
  const walk = createWalk(START, []);
  walk.advance(0.5, AHEAD, 0);
  walk.place({ x: 7, z: -3, yaw: 1 }, WALL);
  const frame = walk.advance(TICK_SECONDS / 3, STILL, 0);
  assert.deepEqual(frame.player, { x: 7, z: -3, yaw: 1 });
});

test('đổi vật cản lúc đặt lại thì vật cản mới có hiệu lực', () => {
  const walk = createWalk(START, []);
  walk.place(START, WALL);
  let frame = walk.advance(0, STILL, 0);
  for (let index = 0; index < 240; index += 1) frame = walk.advance(1 / 60, AHEAD, 0);
  assert.ok(frame.player.z < 2, `walked through the new wall to ${frame.player.z}`);
});

test('khung hình có thời gian hỏng không làm nhân vật nhảy', () => {
  const walk = createWalk(START, []);
  for (const seconds of [Number.NaN, -1, Infinity]) {
    const frame = walk.advance(seconds, AHEAD, 0);
    assert.ok(
      Number.isFinite(frame.player.z) && frame.player.z < 1,
      `${seconds}: ${frame.player.z}`,
    );
  }
});
