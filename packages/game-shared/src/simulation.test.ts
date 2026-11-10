import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepPlayer, type MoveIntent, type PlayerState } from './movement.ts';
import {
  MAX_TICKS_PER_FRAME,
  TICK_SECONDS,
  advanceSimulation,
  createSimulation,
  interpolatePlayer,
  type Simulation,
} from './simulation.ts';

const START: PlayerState = { x: 0, z: 0, yaw: 0 };
const WALL = { minX: 2, maxX: 2.2, minZ: -10, maxZ: 10 };

function keep(state: PlayerState): PlayerState {
  return state;
}

function intentAt(tick: number): MoveIntent {
  if (tick < 40) return { x: 1, z: 0.3, run: false };
  if (tick < 70) return { x: 0.2, z: 1, run: true };
  return { x: -1, z: -0.5, run: false };
}

function playUntil(
  ticks: number,
  frameSecondsAt: (frame: number) => number,
  intentOf: (tick: number) => MoveIntent = intentAt,
): { simulation: Simulation<PlayerState>; seenTicks: number[] } {
  const seenTicks: number[] = [];
  let simulation = createSimulation(START);
  for (let frame = 0; simulation.tick < ticks; frame += 1) {
    assert.ok(frame < 100000, `never reached ${ticks} ticks`);
    simulation = advanceSimulation(simulation, frameSecondsAt(frame), (state, seconds, tick) => {
      if (tick >= ticks) return state;
      seenTicks.push(tick);
      return stepPlayer(state, intentOf(tick), [WALL], seconds);
    });
  }
  return { simulation, seenTicks };
}

test('một khung hình ngắn hơn một nhịp thì chưa chạy nhịp nào', () => {
  let calls = 0;
  const after = advanceSimulation(createSimulation(START), TICK_SECONDS / 2, (state) => {
    calls += 1;
    return state;
  });
  assert.equal(calls, 0);
  assert.equal(after.tick, 0);
  assert.ok(Math.abs(after.alpha - 0.5) < 1e-9);
});

test('phần thời gian dư được cộng dồn sang khung hình sau', () => {
  let simulation = createSimulation(START);
  simulation = advanceSimulation(simulation, TICK_SECONDS * 0.6, keep);
  simulation = advanceSimulation(simulation, TICK_SECONDS * 0.6, keep);
  assert.equal(simulation.tick, 1);
  assert.ok(Math.abs(simulation.alpha - 0.2) < 1e-9);
});

test('mỗi nhịp nhận đúng độ dài nhịp cố định', () => {
  const seen: number[] = [];
  advanceSimulation(createSimulation(START), TICK_SECONDS * 3.5, (state, seconds) => {
    seen.push(seconds);
    return state;
  });
  assert.deepEqual(seen, [TICK_SECONDS, TICK_SECONDS, TICK_SECONDS]);
});

test('số thứ tự nhịp chạy liền mạch qua nhiều khung hình', () => {
  const { seenTicks } = playUntil(
    100,
    (frame) => [0.004, 0.031, 0.017, 0.09, 0.001][frame % 5] ?? 0,
  );
  assert.deepEqual(
    seenTicks,
    Array.from({ length: 100 }, (_, tick) => tick),
  );
});

test('cùng chuỗi đầu vào cho cùng trạng thái dù tốc độ khung hình khác nhau', () => {
  const ticks = 100;
  const smooth = playUntil(ticks, () => 1 / 144).simulation.current;
  const firstIntentOnly = playUntil(
    ticks,
    () => 1 / 144,
    () => intentAt(0),
  ).simulation.current;
  const patterns = [
    () => 1 / 60,
    () => 1 / 20,
    (frame: number) => [0.004, 0.031, 0.017, 0.09, 0.001][frame % 5] ?? 0,
  ];
  assert.notDeepEqual(smooth, firstIntentOnly);
  for (const pattern of patterns) {
    assert.deepEqual(playUntil(ticks, pattern).simulation.current, smooth);
  }
});

test('khung hình bị đứng lâu chỉ chạy bù tối đa vài nhịp rồi bỏ phần còn lại', () => {
  for (const frameSeconds of [30, 30.01, TICK_SECONDS * (MAX_TICKS_PER_FRAME + 1.5)]) {
    let calls = 0;
    const after = advanceSimulation(createSimulation(START), frameSeconds, (state) => {
      calls += 1;
      return state;
    });
    assert.equal(calls, MAX_TICKS_PER_FRAME);
    assert.equal(after.tick, MAX_TICKS_PER_FRAME);
    assert.equal(after.alpha, 0);
  }
});

test('khung hình vừa đủ số nhịp chạy bù tối đa thì vẫn giữ phần dư', () => {
  const frameSeconds = TICK_SECONDS * (MAX_TICKS_PER_FRAME + 0.5);
  const after = advanceSimulation(createSimulation(START), frameSeconds, keep);
  assert.equal(after.tick, MAX_TICKS_PER_FRAME);
  assert.ok(Math.abs(after.alpha - 0.5) < 1e-9);
});

test('thời gian khung hình âm hoặc không phải số thì không chạy nhịp nào', () => {
  for (const frameSeconds of [-1, NaN, Infinity, undefined as unknown as number]) {
    const after = advanceSimulation(createSimulation(START), frameSeconds, () => {
      throw new Error('stepped on a broken frame time');
    });
    assert.equal(after.tick, 0);
    assert.equal(after.alpha, 0);
  }
});

test('giữ trạng thái của nhịp trước để hình vẽ nội suy', () => {
  const after = advanceSimulation(createSimulation(START), TICK_SECONDS * 2, (state) => ({
    ...state,
    x: state.x + 1,
  }));
  assert.equal(after.previous.x, 1);
  assert.equal(after.current.x, 2);
});

test('không sửa mô phỏng đầu vào', () => {
  const simulation = createSimulation(START);
  const copy = structuredClone(simulation);
  advanceSimulation(simulation, TICK_SECONDS * 2, (state) => ({ ...state, x: state.x + 1 }));
  assert.deepEqual(simulation, copy);
});

test('nội suy vị trí theo tỉ lệ giữa hai nhịp', () => {
  const shown = interpolatePlayer({ x: 0, z: 2, yaw: 0 }, { x: 4, z: 0, yaw: 1 }, 0.25);
  assert.deepEqual(shown, { x: 1, z: 1.5, yaw: 0.25 });
});

test('nội suy hướng nhìn đi thẳng khi hai hướng lệch chưa tới nửa vòng', () => {
  const shown = interpolatePlayer({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 2.5 }, 0.5);
  assert.ok(Math.abs(shown.yaw - 1.25) < 1e-9, `turned to ${shown.yaw}`);
});

test('nội suy hướng nhìn theo cung ngắn nhất qua mốc pi', () => {
  const before = { x: 0, z: 0, yaw: Math.PI - 0.1 };
  const after = { x: 0, z: 0, yaw: -Math.PI + 0.1 };
  const shown = interpolatePlayer(before, after, 0.5);
  assert.ok(Math.abs(Math.abs(shown.yaw) - Math.PI) < 1e-9, `turned the long way to ${shown.yaw}`);
});

test('nội suy hướng nhìn bỏ qua các vòng quay thừa', () => {
  const before = { x: 0, z: 0, yaw: 0.2 };
  const after = { x: 0, z: 0, yaw: 0.6 + Math.PI * 6 };
  const shown = interpolatePlayer(before, after, 0.5);
  assert.ok(Math.abs(shown.yaw - 0.4) < 1e-9, `spun to ${shown.yaw}`);
});
