import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collisionBoxes } from './collision.ts';
import type { KitAnchors, Placement } from './collision.ts';
import { PLAYER_RADIUS, stepPlayer } from './movement.ts';
import type { FloorBox, PlayerState } from './movement.ts';

const EAST = Math.PI / 2;
const NORTH = Math.PI;
const WEST = -Math.PI / 2;
const WALL_INNER_FACE = 0.8;

const ANCHORS: KitAnchors = {
  desk_a: {
    socket_chair: { position: [0, 0, -0.24], scale: [1, 1, 1] },
    interact_point: { position: [0, 0, -0.95], scale: [1, 1, 1] },
    not_collision_marker: { position: [5, 0, 5], scale: [1, 1, 1] },
    collision_main: { position: [0, 0.36, 0.46], scale: [0.76, 0.36, 0.35] },
  },
  chair_a: {
    seat_anchor: { position: [0, 0.5, 0], scale: [1, 1, 1] },
    collision_main: { position: [0, 0.62, -0.03], scale: [0.32, 0.62, 0.33] },
  },
  floor_a: {},
  wall_a: { collision_main: { position: [0, 1.5, 0.9], scale: [1, 1.5, 0.1] } },
  corner_a: {
    collision_a: { position: [0, 1.5, 0.9], scale: [1, 1.5, 0.1] },
    collision_b: { position: [-0.9, 1.5, 0], scale: [0.1, 1.5, 1] },
  },
  door_a: {
    collision_left: { position: [-0.88, 1.5, 0.9], scale: [0.12, 1.5, 0.1] },
    collision_right: { position: [0.88, 1.5, 0.9], scale: [0.12, 1.5, 0.1] },
  },
};

function placed(part: string, x: number, z: number, yaw = 0): Placement {
  return { part, position: [x, 0, z], yaw };
}

function near(actual: FloorBox | undefined, expected: FloorBox): void {
  assert.ok(actual, 'missing box');
  for (const edge of ['minX', 'maxX', 'minZ', 'maxZ'] as const) {
    assert.ok(
      Math.abs(actual[edge] - expected[edge]) < 1e-6,
      `${edge}: ${actual[edge]} is not ${expected[edge]}`,
    );
  }
}

function squareRoom(southEast: string): Placement[] {
  return [
    placed('floor_a', -1, -1),
    placed('floor_a', 1, -1),
    placed('floor_a', -1, 1),
    placed('floor_a', 1, 1),
    placed('corner_a', -1, -1, WEST),
    placed('corner_a', 1, -1, NORTH),
    placed('corner_a', -1, 1, 0),
    ...(southEast === 'corner_a'
      ? [placed('corner_a', 1, 1, EAST)]
      : [placed(southEast, 1, 1, 0), placed('wall_a', 1, 1, EAST)]),
  ];
}

function walk(
  from: PlayerState,
  intent: { x: number; z: number },
  boxes: readonly FloorBox[],
  ticks = 240,
): PlayerState {
  let player = from;
  for (let tick = 0; tick < ticks; tick += 1) {
    player = stepPlayer(player, intent, boxes, 1 / 30);
  }
  return player;
}

test('món không xoay cho hộp nằm quanh điểm neo, rộng theo x và sâu theo z', () => {
  const boxes = collisionBoxes([placed('desk_a', 4, -2)], ANCHORS);
  assert.equal(boxes.length, 1);
  near(boxes[0], { minX: 3.24, maxX: 4.76, minZ: -1.89, maxZ: -1.19 });
});

test('món quay 90 độ thì hộp đổi chiều rộng và chiều sâu, tâm hộp quay theo', () => {
  const boxes = collisionBoxes([placed('desk_a', 4, -2, EAST)], ANCHORS);
  near(boxes[0], { minX: 4.11, maxX: 4.81, minZ: -2.76, maxZ: -1.24 });
});

test('bốn hướng đặt đưa cùng một hộp tường về bốn cạnh của ô', () => {
  const [south, east, north, west] = collisionBoxes(
    [0, EAST, NORTH, WEST].map((yaw) => placed('wall_a', 0, 0, yaw)),
    ANCHORS,
  );
  near(south, { minX: -1, maxX: 1, minZ: 0.8, maxZ: 1 });
  near(east, { minX: 0.8, maxX: 1, minZ: -1, maxZ: 1 });
  near(north, { minX: -1, maxX: 1, minZ: -1, maxZ: -0.8 });
  near(west, { minX: -1, maxX: -0.8, minZ: -1, maxZ: 1 });
});

test('món mang nhiều điểm neo va chạm cho đủ từng hộp', () => {
  const boxes = collisionBoxes([placed('corner_a', 0, 0)], ANCHORS);
  assert.equal(boxes.length, 2);
  near(boxes[0], { minX: -1, maxX: 1, minZ: 0.8, maxZ: 1 });
  near(boxes[1], { minX: -1, maxX: -0.8, minZ: -1, maxZ: 1 });
});

test('điểm neo không phải va chạm và món không có điểm neo thì không sinh hộp', () => {
  const boxes = collisionBoxes(
    [placed('floor_a', 0, 0), placed('chair_a', 0, 0), placed('poster_a', 0, 0)],
    ANCHORS,
  );
  assert.equal(boxes.length, 1);
  near(boxes[0], { minX: -0.32, maxX: 0.32, minZ: -0.36, maxZ: 0.3 });
});

test('món xoay lệch góc vuông cho hộp song song trục bao trọn hộp đã xoay', () => {
  const [box] = collisionBoxes([placed('wall_a', 0, 0, Math.PI / 4)], ANCHORS);
  const reach = (1 + 0.1) * Math.SQRT1_2;
  const centre = 0.9 * Math.SQRT1_2;
  near(box, {
    minX: centre - reach,
    maxX: centre + reach,
    minZ: centre - reach,
    maxZ: centre + reach,
  });
});

test('hộp không phụ thuộc độ cao đặt món', () => {
  const low = collisionBoxes([{ part: 'desk_a', position: [1, 0, 1], yaw: 0 }], ANCHORS);
  const high = collisionBoxes([{ part: 'desk_a', position: [1, 7, 1], yaw: 0 }], ANCHORS);
  assert.deepEqual(high, low);
});

test('kết quả góc vuông không dính sai số dấu phẩy động', () => {
  const [box] = collisionBoxes([placed('wall_a', -1, -3, EAST)], ANCHORS);
  assert.deepEqual(box, { minX: -0.2, maxX: 0, minZ: -4, maxZ: -2 });
});

test('số đo hỏng trong món đặt hoặc điểm neo bị báo lỗi kèm tên món', () => {
  assert.throws(() => collisionBoxes([placed('desk_a', Number.NaN, 0)], ANCHORS), /desk_a/);
  assert.throws(() => collisionBoxes([placed('desk_a', 0, 0, Infinity)], ANCHORS), /desk_a/);
  const broken: KitAnchors = {
    crate_a: { collision_main: { position: [0, 0, 0], scale: [0.5, 0.5] } },
  };
  assert.throws(() => collisionBoxes([placed('crate_a', 0, 0)], broken), /crate_a.*collision_main/);
  const flat: KitAnchors = {
    crate_a: { collision_main: { position: [0, 0, 0], scale: [0, 1, 0.5] } },
  };
  assert.throws(() => collisionBoxes([placed('crate_a', 0, 0)], flat), /crate_a.*collision_main/);
});

test('tường quanh phòng chặn người chơi ở mép phòng theo cả bốn hướng', () => {
  const boxes = collisionBoxes(squareRoom('corner_a'), ANCHORS);
  const limit = 1 + WALL_INNER_FACE - PLAYER_RADIUS;
  const start = { x: 0.3, z: -0.2, yaw: 0 };
  const south = walk(start, { x: 0, z: 1 }, boxes);
  const north = walk(start, { x: 0, z: -1 }, boxes);
  const east = walk(start, { x: 1, z: 0 }, boxes);
  const west = walk(start, { x: -1, z: 0 }, boxes);
  assert.ok(Math.abs(south.z - limit) < 1e-6, `south stopped at ${south.z}`);
  assert.ok(Math.abs(north.z + limit) < 1e-6, `north stopped at ${north.z}`);
  assert.ok(Math.abs(east.x - limit) < 1e-6, `east stopped at ${east.x}`);
  assert.ok(Math.abs(west.x + limit) < 1e-6, `west stopped at ${west.x}`);
});

test('đi chéo vào góc phòng thì dừng trong góc, không lọt ra ngoài', () => {
  const boxes = collisionBoxes(squareRoom('corner_a'), ANCHORS);
  const limit = 1 + WALL_INNER_FACE - PLAYER_RADIUS;
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const end = walk({ x: 0, z: 0, yaw: 0 }, { x, z }, boxes);
    assert.ok(Math.abs(end.x - x * limit) < 1e-6, `${x},${z} ended at x ${end.x}`);
    assert.ok(Math.abs(end.z - z * limit) < 1e-6, `${x},${z} ended at z ${end.z}`);
  }
});

test('ô cửa cho người chơi đi qua giữa hai trụ, còn hai trụ vẫn chặn', () => {
  const boxes = collisionBoxes(squareRoom('door_a'), ANCHORS);
  const through = walk({ x: 1, z: 0, yaw: 0 }, { x: 0, z: 1 }, boxes, 90);
  assert.ok(through.z > 2.5, `stuck in the doorway at ${through.z}`);
  const beside = walk({ x: 0.2, z: 0, yaw: 0 }, { x: 0, z: 1 }, boxes, 90);
  assert.ok(beside.z < 2, `walked through the door post to ${beside.z}`);
});

test('nửa kích thước âm, điểm neo thiếu số đo đều bị báo lỗi kèm tên món và tên điểm neo', () => {
  const mirrored: KitAnchors = {
    crate_a: { collision_main: { position: [0, 0, 0], scale: [-0.5, 1, 0.5] } },
  };
  assert.throws(
    () => collisionBoxes([placed('crate_a', 0, 0)], mirrored),
    /crate_a collision_main/,
  );
  const hollow = { crate_a: { collision_main: {} } } as unknown as KitAnchors;
  assert.throws(() => collisionBoxes([placed('crate_a', 0, 0)], hollow), /crate_a collision_main/);
});

test('món đặt có số đo hỏng bị báo lỗi kể cả khi món đó không có hộp va chạm', () => {
  assert.throws(() => collisionBoxes([placed('floor_a', Number.NaN, 0)], ANCHORS), /floor_a/);
  assert.throws(() => collisionBoxes([placed('poster_a', 0, 0, Number.NaN)], ANCHORS), /poster_a/);
});

test('cạnh hộp bằng không được ghi là số không dương', () => {
  const [box] = collisionBoxes([placed('wall_a', 1, -1, WEST)], ANCHORS);
  assert.ok(Object.is(box?.minX, 0), 'minX is negative zero');
});
