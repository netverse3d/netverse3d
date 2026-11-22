import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createTrafficLane, parkedVehiclePlacements, wheelSpinAngle } from './traffic.mjs';
import { createJunctionPlan } from './signal-phases.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sample = JSON.parse(readFileSync(join(root, 'blocks/hem-mau.json'), 'utf8'));

test('xe máy đậu tất định trước lô có tiệm và chừa lối đi trước cửa', () => {
  const first = parkedVehiclePlacements(sample);
  assert.deepEqual(first, parkedVehiclePlacements(sample));
  assert.equal(first.length, 2);
  assert.ok(first.every((item) => item.lot === 'lo-1' && item.slot === 'motorbike'));
  assert.ok(first.every((item) => item.position[2] > 3 && item.position[2] < 4));
  assert.ok(first.every((item) => item.position[0] >= -8 && item.position[0] <= 0));
  assert.deepEqual(parkedVehiclePlacements({ ...sample, lots: [] }), []);
});

test('ô tô chỉ đậu dọc bó vỉa khi mặt đường đủ rộng', () => {
  const wide = {
    ...sample,
    cells: [4, 4],
    roads: [...sample.roads, ...sample.roads.map((road) => ({ ...road, cell: [road.cell[0], 3] }))],
  };
  const parked = parkedVehiclePlacements(wide);
  assert.ok(parked.some((item) => item.slot === 'car'));
  assert.ok(parked.filter((item) => item.slot === 'car').every((item) => item.yaw === Math.PI / 2));
  assert.ok(parked.every((item) => item.lot === 'lo-1'));
});

test('xe đi hết làn theo thời lượng rồi trở lại đầu làn', () => {
  const lane = createTrafficLane(sample, { duration: 12, count: 2 });
  assert.deepEqual(lane.positionAt(0, 0).position, lane.positionAt(12, 0).position);
  assert.deepEqual(lane.positionAt(0, 0).position, lane.positionAt(24, 0).position);
  assert.ok(lane.positionAt(6, 0).position[0] > lane.positionAt(0, 0).position[0]);
  assert.equal(lane.positionAt(0, 0).yaw, Math.PI / 2);
  assert.ok(lane.positionAt(12 - 1e-6, 0).position[0] > lane.positionAt(0, 0).position[0]);
});

test('xe cùng làn giữ khoảng cách và mọi điểm lấy mẫu nằm trong ô đường', () => {
  const lane = createTrafficLane(sample, { duration: 18, count: 2, lateralOffset: 0.55 });
  const roadCentres = sample.roads.map(({ cell }) => [
    (cell[0] - (sample.cells[0] - 1) / 2) * 4,
    (cell[1] - (sample.cells[1] - 1) / 2) * 4,
  ]);
  for (let time = 0; time < 36; time += 0.1) {
    const a = lane.positionAt(time, 0);
    const b = lane.positionAt(time, 1);
    const separation = Math.abs(a.distance - b.distance);
    assert.ok(Math.min(separation, lane.length - separation) >= lane.minimumGap - 1e-6);
    for (const state of [a, b]) {
      const [x, , z] = state.position;
      assert.ok(roadCentres.some(([cx, cz]) => Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2));
    }
  }
});

test('không tạo làn nhảy qua ô đường bị thiếu', () => {
  const broken = { ...sample, roads: [sample.roads[0], sample.roads[2]] };
  assert.throws(() => createTrafficLane(broken), RangeError);
});

test('góc quay bánh lấy từ quãng đường và bán kính, kể cả sau khi xe đi hết làn', () => {
  assert.equal(wheelSpinAngle(0, 0.3), 0);
  assert.ok(Math.abs(wheelSpinAngle(Math.PI * 0.3, 0.3) - Math.PI) < 1e-10);
  const lane = createTrafficLane(sample, { duration: 12, count: 1 });
  assert.ok(lane.positionAt(13, 0).travelled > lane.positionAt(1, 0).travelled);
  assert.throws(() => wheelSpinAngle(1, 0), RangeError);
});

test('xe dừng trước vạch đỏ, chỉ đi tiếp khi xanh', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 2, allRed: 3 });
  const lane = createTrafficLane(sample, {
    duration: 12,
    count: 1,
    stopLines: [{ distance: 10, arm: 'west', plan }],
  });
  const stopped = lane.positionAt(17, 0);
  assert.ok(stopped.distance <= 10 - 2.4);
  assert.deepEqual(stopped, lane.positionAt(17, 0));
  assert.ok(lane.positionAt(27, 0).travelled > stopped.travelled);
});

test('xe còn đủ quãng hãm thì dừng từ pha vàng', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 2, allRed: 3 });
  const lane = createTrafficLane(sample, {
    duration: 12,
    count: 1,
    stopLines: [{ distance: 11.5, arm: 'west', plan }],
  });
  assert.ok(lane.positionAt(9, 0).distance < 9.1);
  assert.ok(Math.abs(lane.positionAt(11, 0).distance - 9.1) < 1e-6);
});

test('xe quá gần vạch khi vàng tiếp tục qua dù đèn vừa đỏ', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 0.1, allRed: 3 });
  const lane = createTrafficLane(sample, {
    duration: 12,
    count: 1,
    stopLines: [{ distance: 10.6, arm: 'west', plan }],
  });
  assert.ok(lane.positionAt(8.4, 0).travelled > 8.2);
});

test('xe giữ khoảng cách tối thiểu và hoàn tất nhiều vòng trong mười phút', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 2, allRed: 3 });
  const lane = createTrafficLane(sample, {
    duration: 12,
    count: 2,
    minimumGap: 5.4,
    stopLines: [{ distance: 10, arm: 'west', plan }],
  });
  for (let t = 0; t <= 600; t += 0.2) {
    const a = lane.positionAt(t, 0);
    const b = lane.positionAt(t, 1);
    const gap = Math.abs(a.distance - b.distance);
    assert.ok(Math.min(gap, lane.length - gap) >= lane.minimumGap - 1e-6, `gap at ${t}`);
  }
  assert.ok(lane.positionAt(600, 0).travelled > lane.length * 10);
  assert.ok(lane.positionAt(600, 1).travelled > lane.length * 10);
});

test('bộ nhớ mô phỏng làn xe giữ số frame cố định sau hai giờ', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 2, allRed: 3 });
  const lane = createTrafficLane(sample, {
    duration: 12,
    count: 2,
    stopLines: [{ distance: 10, arm: 'west', plan }],
  });
  for (let time = 0; time <= 7200; time += 1) lane.positionAt(time, 0);
  assert.ok(lane.retainedFrameCount() <= 3);
  const early = lane.positionAt(17, 0);
  assert.deepEqual(
    early,
    createTrafficLane(sample, {
      duration: 12,
      count: 2,
      stopLines: [{ distance: 10, arm: 'west', plan }],
    }).positionAt(17, 0),
  );
  assert.ok(lane.retainedFrameCount() <= 3);
});

test('thời điểm rất xa trả nhanh và không phụ thuộc thứ tự lấy mẫu', () => {
  const plan = createJunctionPlan({ arms: ['west', 'north'], green: 8, yellow: 2, allRed: 3 });
  const options = {
    duration: 12,
    count: 2,
    stopLines: [{ distance: 10, arm: 'west', plan }],
  };
  const lane = createTrafficLane(sample, options);
  const start = performance.now();
  const far = lane.positionAt(1e7, 0);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 200, `truy vấn mất ${elapsed} ms`);
  lane.positionAt(11, 1);
  lane.positionAt(7200, 0);
  assert.deepEqual(lane.positionAt(1e7, 0), far);
  const reversed = createTrafficLane(sample, options);
  reversed.positionAt(1e7 + 20, 1);
  reversed.positionAt(17, 0);
  assert.deepEqual(reversed.positionAt(1e7, 0), far);
});
