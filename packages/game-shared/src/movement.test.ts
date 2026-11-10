import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_STEP_SECONDS,
  PLAYER_RADIUS,
  RUN_SPEED,
  WALK_SPEED,
  stepPlayer,
  type FloorBox,
  type FloorPoint,
  type MoveIntent,
  type PlayerState,
} from './movement.ts';

const TOLERANCE = 1e-6;
const START: PlayerState = { x: 0, z: 0, yaw: 0 };
const WALL_EAST = { minX: 2, maxX: 2.2, minZ: -10, maxZ: 10 };
const WALL_SOUTH = { minX: -10, maxX: 10, minZ: 2, maxZ: 2.2 };
const WALL_NEAR_SEGMENT = { minX: 2, maxX: 3, minZ: -50, maxZ: 1 };
const WALL_FAR_SEGMENT = { minX: 2, maxX: 3, minZ: 1, maxZ: 80 };
const WALL_WHOLE = { minX: 2, maxX: 3, minZ: -50, maxZ: 80 };
const TICK_RATES = [20, 30, 60];

function near(actual: number, expected: number, tolerance = TOLERANCE): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);
}

function walk(
  player: PlayerState,
  intent: MoveIntent,
  obstacles: readonly FloorBox[],
  seconds: number,
  ticks: number,
): PlayerState {
  let current = player;
  for (let tick = 0; tick < ticks; tick += 1)
    current = stepPlayer(current, intent, obstacles, seconds);
  return current;
}

function gapTo(player: FloorPoint, box: FloorBox): number {
  const nearestX = Math.min(Math.max(player.x, box.minX), box.maxX);
  const nearestZ = Math.min(Math.max(player.z, box.minZ), box.maxZ);
  return Math.hypot(player.x - nearestX, player.z - nearestZ);
}

function corridor(width: number): FloorBox[] {
  return [
    { minX: 2, maxX: 6, minZ: width / 2, maxZ: 5 },
    { minX: 2, maxX: 6, minZ: -5, maxZ: -width / 2 },
  ];
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBoxes(random: () => number, count: number): FloorBox[] {
  const boxes: FloorBox[] = [];
  while (boxes.length < count) {
    const minX = random() * 16 - 8;
    const minZ = random() * 16 - 8;
    const box = { minX, maxX: minX + 0.2 + random() * 2, minZ, maxZ: minZ + 0.2 + random() * 2 };
    if (gapTo(START, box) > PLAYER_RADIUS * 2) boxes.push(box);
  }
  return boxes;
}

test('đi trong khoảng trống được quãng đường bằng tốc độ đi bộ nhân thời gian', () => {
  const after = stepPlayer(START, { x: 1, z: 0 }, [], 0.2);
  near(after.x, WALK_SPEED * 0.2);
  near(after.z, 0);
});

test('giữ nút chạy thì đi theo tốc độ chạy', () => {
  const after = stepPlayer(START, { x: 0, z: 1, run: true }, [], 0.2);
  near(after.z, RUN_SPEED * 0.2);
  assert.ok(RUN_SPEED > WALK_SPEED);
});

test('đi chéo không nhanh hơn đi thẳng', () => {
  const after = stepPlayer(START, { x: 1, z: 1 }, [], 0.2);
  near(Math.hypot(after.x, after.z), WALK_SPEED * 0.2);
});

test('đẩy nhẹ cần ảo thì đi chậm theo tỉ lệ', () => {
  const after = stepPlayer(START, { x: 0.5, z: 0 }, [], 0.2);
  near(after.x, WALK_SPEED * 0.2 * 0.5);
});

test('không có đầu vào thì đứng yên và giữ hướng nhìn', () => {
  const facing = { x: 3, z: 4, yaw: 1.25 };
  assert.deepEqual(stepPlayer(facing, { x: 0, z: 0 }, [], 0.2), facing);
});

test('thời gian bằng không hoặc âm thì giữ nguyên cả vị trí lẫn hướng nhìn', () => {
  const facing = { x: 3, z: 4, yaw: 1.25 };
  assert.deepEqual(stepPlayer(facing, { x: 1, z: 0 }, [], 0), facing);
  assert.deepEqual(stepPlayer(facing, { x: 1, z: 0 }, [], -1), facing);
});

test('quay mặt theo hướng đang đi', () => {
  near(stepPlayer(START, { x: 1, z: 0 }, [], 0.1).yaw, Math.PI / 2);
  near(stepPlayer(START, { x: 0, z: -1 }, [], 0.1).yaw, Math.PI);
});

test('bị tường chặn vẫn quay mặt về hướng đang đẩy', () => {
  const blocked = { x: WALL_EAST.minX - PLAYER_RADIUS, z: 0, yaw: 0 };
  const after = stepPlayer(blocked, { x: 1, z: 0 }, [WALL_EAST], 0.1);
  near(after.x, blocked.x);
  near(after.yaw, Math.PI / 2);
});

test('đi thẳng vào tường thì dừng cách mặt tường đúng một bán kính', () => {
  const after = walk(START, { x: 1, z: 0 }, [WALL_EAST], 1 / 30, 120);
  near(after.x, WALL_EAST.minX - PLAYER_RADIUS);
  near(after.z, 0);
});

test('không đi xuyên tường mỏng trong một bước đi xa hơn cả bề dày tường', () => {
  const thinWall = { minX: 0.5, maxX: 0.55, minZ: -10, maxZ: 10 };
  const after = stepPlayer(START, { x: 1, z: 0, run: true }, [thinWall], MAX_STEP_SECONDS);
  assert.ok(RUN_SPEED * MAX_STEP_SECONDS > thinWall.maxX + PLAYER_RADIUS);
  near(after.x, thinWall.minX - PLAYER_RADIUS);
});

test('đi chéo vào tường thì trượt dọc tường với trọn tốc độ dọc tường', () => {
  const seconds = 1 / 30;
  const ticks = 120;
  const after = walk(START, { x: 1, z: 1 }, [WALL_EAST], seconds, ticks);
  near(after.x, WALL_EAST.minX - PLAYER_RADIUS);
  near(after.z, WALK_SPEED * Math.SQRT1_2 * seconds * ticks);
});

test('trượt qua chỗ nối hai đoạn tường y như trượt dọc một bức tường liền', () => {
  const along = WALL_WHOLE.minX - PLAYER_RADIUS;
  const routes = [
    { from: { x: along, z: 0, yaw: 0 }, intents: [0.1, 0.2, 1] },
    { from: { x: along, z: 2, yaw: 0 }, intents: [-0.1, -0.2, -1] },
  ];
  const orders = [
    [WALL_NEAR_SEGMENT, WALL_FAR_SEGMENT],
    [WALL_FAR_SEGMENT, WALL_NEAR_SEGMENT],
  ];
  for (const { from, intents } of routes) {
    for (const z of intents) {
      for (const run of [false, true]) {
        const intent = { x: 1, z, run };
        const expected = walk(from, intent, [WALL_WHOLE], 1 / 30, 300);
        for (const order of orders) {
          const actual = walk(from, intent, order, 1 / 30, 300);
          near(actual.x, expected.x);
          near(actual.z, expected.z);
        }
      }
    }
  }
});

test('bị dồn vào góc hai tường thì đứng lại đúng trong góc', () => {
  for (const run of [false, true]) {
    const after = walk(START, { x: 1, z: 1, run }, [WALL_EAST, WALL_SOUTH], 1 / 30, 240);
    near(after.x, WALL_EAST.minX - PLAYER_RADIUS);
    near(after.z, WALL_SOUTH.minZ - PLAYER_RADIUS);
  }
});

test('đi sượt qua góc hộp thì vòng theo góc chứ không cắt qua', () => {
  const crate = { minX: 1, maxX: 2, minZ: 0.2, maxZ: 1.2 };
  let current = START;
  for (let tick = 0; tick < 200; tick += 1) {
    current = stepPlayer(current, { x: 1, z: 0 }, [crate], 1 / 30);
    assert.ok(
      gapTo(current, crate) >= PLAYER_RADIUS - TOLERANCE,
      `overlaps the crate at tick ${tick}`,
    );
  }
  assert.ok(current.x > crate.maxX, `stuck at x = ${current.x}`);
});

test('khe hẹp hơn thân người thì không lọt qua ở mọi nhịp mô phỏng', () => {
  for (const width of [0.3, 0.5, 0.56, 0.58]) {
    for (const rate of TICK_RATES) {
      for (const run of [false, true]) {
        const after = walk(START, { x: 1, z: 0, run }, corridor(width), 1 / rate, rate * 10);
        assert.ok(after.x < 2, `squeezed through a ${width} m gap at ${rate} Hz to x = ${after.x}`);
      }
    }
  }
});

test('khe rộng hơn thân người thì đi qua được ở mọi nhịp mô phỏng', () => {
  for (const rate of TICK_RATES) {
    const after = walk(START, { x: 1, z: 0 }, corridor(0.7), 1 / rate, rate * 10);
    assert.ok(after.x > 6, `blocked at x = ${after.x} at ${rate} Hz`);
  }
});

test('đi lung tung giữa nhiều hộp không bao giờ lấn vào hộp và không nhảy quá hai lần quãng của một bước', () => {
  const random = seededRandom(115);
  for (let map = 0; map < 200; map += 1) {
    const boxes = randomBoxes(random, 12);
    const seconds = 1 / (TICK_RATES[map % TICK_RATES.length] ?? 30);
    let current = START;
    let intent: MoveIntent = { x: 0, z: 0, run: false };
    for (let tick = 0; tick < 300; tick += 1) {
      if (tick % 20 === 0)
        intent = { x: random() * 2 - 1, z: random() * 2 - 1, run: random() < 0.5 };
      const next = stepPlayer(current, intent, boxes, seconds);
      const moved = Math.hypot(next.x - current.x, next.z - current.z);
      const reach = (intent.run ? RUN_SPEED : WALK_SPEED) * seconds;
      assert.ok(moved <= reach * 2 + TOLERANCE, `jumped ${moved} m on map ${map} tick ${tick}`);
      for (const box of boxes) {
        assert.ok(
          gapTo(next, box) >= PLAYER_RADIUS - TOLERANCE,
          `overlaps a box on map ${map} tick ${tick}`,
        );
      }
      current = next;
    }
  }
});

test('tâm nằm trong hộp thì bị đẩy ra qua cạnh gần nhất', () => {
  const crate = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 };
  const after = stepPlayer({ x: 0.1, z: 1, yaw: 0 }, { x: 0, z: 1 }, [crate], 1 / 30);
  near(after.x, crate.minX - PLAYER_RADIUS);
});

test('đứng yên khi đang lấn vào hộp vẫn được đẩy ra', () => {
  const crate = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  const after = stepPlayer({ x: 0.9, z: 0, yaw: 1.25 }, { x: 0, z: 0 }, [crate], 1 / 30);
  near(after.x, crate.maxX + PLAYER_RADIUS);
  near(after.yaw, 1.25);
});

test('bước thời gian quá dài bị cắt về trần và trả lời ngay', () => {
  const capped = stepPlayer(START, { x: 1, z: 0 }, [], MAX_STEP_SECONDS);
  for (const seconds of [MAX_STEP_SECONDS * 4, 1e12, Infinity]) {
    assert.deepEqual(stepPlayer(START, { x: 1, z: 0 }, [], seconds), capped);
  }
});

test('đầu vào không phải số hữu hạn thì đứng yên, không sinh NaN', () => {
  const facing = { x: 3, z: 4, yaw: 1.25 };
  for (const intent of [
    { x: NaN, z: 0 },
    { x: Infinity, z: 0 },
    { x: 1, z: -Infinity },
    {} as MoveIntent,
  ]) {
    assert.deepEqual(stepPlayer(facing, intent, [], 0.1), facing);
  }
  assert.deepEqual(stepPlayer(facing, { x: 1, z: 0 }, [], NaN), facing);
  assert.deepEqual(stepPlayer(facing, { x: 1, z: 0 }, [], undefined as unknown as number), facing);
});

test('hộp có toạ độ hỏng bị bỏ qua thay vì làm hỏng vị trí', () => {
  const broken = { minX: NaN, maxX: 3, minZ: -1, maxZ: 1 };
  const after = stepPlayer(START, { x: 1, z: 0 }, [broken], 0.1);
  near(after.x, WALK_SPEED * 0.1);
  near(after.z, 0);
});

test('không sửa trạng thái đầu vào', () => {
  const player = { x: 0, z: 0, yaw: 0 };
  stepPlayer(player, { x: 1, z: 0 }, [WALL_EAST], 0.2);
  assert.deepEqual(player, { x: 0, z: 0, yaw: 0 });
});
