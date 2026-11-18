import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createTrafficLane, parkedVehiclePlacements, wheelSpinAngle } from './traffic.mjs';

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
