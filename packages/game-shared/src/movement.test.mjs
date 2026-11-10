import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAYER_RADIUS, RUN_SPEED, WALK_SPEED, stepPlayer } from './movement.mjs';

const START = { x: 0, z: 0, yaw: 0 };
const WALL_EAST = { minX: 2, maxX: 2.2, minZ: -10, maxZ: 10 };
const WALL_SOUTH = { minX: -10, maxX: 10, minZ: 2, maxZ: 2.2 };
const THIN_WALL = { minX: 1, maxX: 1.05, minZ: -10, maxZ: 10 };

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} khác ${expected}`);
}

function walk(player, intent, obstacles, seconds, ticks) {
  let current = player;
  for (let tick = 0; tick < ticks; tick += 1)
    current = stepPlayer(current, intent, obstacles, seconds);
  return current;
}

test('đi trong khoảng trống được quãng đường bằng tốc độ đi bộ nhân thời gian', () => {
  const after = stepPlayer(START, { x: 1, z: 0 }, [], 0.5);
  near(after.x, WALK_SPEED * 0.5);
  near(after.z, 0);
});

test('giữ nút chạy thì đi theo tốc độ chạy', () => {
  const after = stepPlayer(START, { x: 0, z: 1, run: true }, [], 0.5);
  near(after.z, RUN_SPEED * 0.5);
  assert.ok(RUN_SPEED > WALK_SPEED);
});

test('đi chéo không nhanh hơn đi thẳng', () => {
  const after = stepPlayer(START, { x: 1, z: 1 }, [], 1);
  near(Math.hypot(after.x, after.z), WALK_SPEED);
});

test('đẩy nhẹ cần ảo thì đi chậm theo tỉ lệ', () => {
  const after = stepPlayer(START, { x: 0.5, z: 0 }, [], 1);
  near(after.x, WALK_SPEED * 0.5);
});

test('không có đầu vào thì đứng yên và giữ hướng nhìn', () => {
  const facing = { x: 3, z: 4, yaw: 1.25 };
  assert.deepEqual(stepPlayer(facing, { x: 0, z: 0 }, [], 1), facing);
});

test('quay mặt theo hướng đang đi', () => {
  near(stepPlayer(START, { x: 1, z: 0 }, [], 0.1).yaw, Math.PI / 2);
  near(stepPlayer(START, { x: 0, z: -1 }, [], 0.1).yaw, Math.PI);
});

test('đi thẳng vào tường thì dừng cách mặt tường đúng một bán kính', () => {
  const after = walk(START, { x: 1, z: 0 }, [WALL_EAST], 1 / 30, 120);
  near(after.x, WALL_EAST.minX - PLAYER_RADIUS);
  near(after.z, 0);
});

test('không đi xuyên tường mỏng dù một bước thời gian rất dài', () => {
  const after = stepPlayer(START, { x: 1, z: 0, run: true }, [THIN_WALL], 2);
  assert.ok(after.x <= THIN_WALL.minX - PLAYER_RADIUS + 1e-6, `đã lọt tới x = ${after.x}`);
});

test('đi chéo vào tường thì trượt dọc tường', () => {
  const after = walk(START, { x: 1, z: 1 }, [WALL_EAST], 1 / 30, 120);
  near(after.x, WALL_EAST.minX - PLAYER_RADIUS);
  assert.ok(after.z > 2, `chỉ trượt được tới z = ${after.z}`);
});

test('bị dồn vào góc hai tường thì đứng lại trong góc', () => {
  const after = walk(START, { x: 1, z: 1 }, [WALL_EAST, WALL_SOUTH], 1 / 30, 240);
  near(after.x, WALL_EAST.minX - PLAYER_RADIUS, 1e-3);
  near(after.z, WALL_SOUTH.minZ - PLAYER_RADIUS, 1e-3);
});

test('đi sượt qua góc hộp thì vòng theo góc chứ không cắt qua', () => {
  const crate = { minX: 1, maxX: 2, minZ: 0.2, maxZ: 1.2 };
  let current = START;
  for (let tick = 0; tick < 200; tick += 1) {
    current = stepPlayer(current, { x: 1, z: 0 }, [crate], 1 / 30);
    const nearestX = Math.min(Math.max(current.x, crate.minX), crate.maxX);
    const nearestZ = Math.min(Math.max(current.z, crate.minZ), crate.maxZ);
    const gap = Math.hypot(current.x - nearestX, current.z - nearestZ);
    assert.ok(gap >= PLAYER_RADIUS - 1e-6, `lấn vào hộp ở khung ${tick}`);
  }
  assert.ok(current.x > crate.maxX, `kẹt lại ở x = ${current.x}`);
});

test('tâm nằm trong hộp thì bị đẩy ra qua cạnh gần nhất', () => {
  const crate = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
  const after = stepPlayer({ x: 0.1, z: 1, yaw: 0 }, { x: 0, z: 1 }, [crate], 1 / 30);
  near(after.x, crate.minX - PLAYER_RADIUS);
});

test('không sửa trạng thái đầu vào', () => {
  const player = { x: 0, z: 0, yaw: 0 };
  stepPlayer(player, { x: 1, z: 0 }, [WALL_EAST], 1);
  assert.deepEqual(player, { x: 0, z: 0, yaw: 0 });
});
