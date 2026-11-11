import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkCoplanar,
  coplanarOverlaps,
  overlapArea,
  partTriangles,
  placeTriangles,
  facadeAssemblies,
  roomAssemblies,
} from './coplanar.mjs';
import { isLfsPointer, loadConfig, readGlb, readGlbBinary } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('lưới chỉ khai số đỉnh mà không có dữ liệu thì không có tam giác để kiểm', () => {
  const gltf = {
    nodes: [{ name: 'chair_a', mesh: 0 }],
    meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }],
    accessors: [{ count: 3 }, { count: 3, min: [0, 0, 0], max: [1, 1, 1] }],
  };
  assert.deepEqual(partTriangles(gltf, Buffer.alloc(0), 'chair_a'), []);
  assert.deepEqual(partTriangles(gltf, Buffer.alloc(0), 'missing'), []);
  assert.deepEqual(checkCoplanar(gltf, Buffer.alloc(0), ['chair_a']), []);
});

function box([x0, x1], [y0, y1], [z0, z1]) {
  const min = [x0, y0, z0];
  const max = [x1, y1, z1];
  const triangles = [];
  for (const axis of [0, 1, 2]) {
    const [p, q] = [(axis + 1) % 3, (axis + 2) % 3];
    const corners = [
      [min[p], min[q]],
      [max[p], min[q]],
      [max[p], max[q]],
      [min[p], max[q]],
    ];
    for (const [side, order] of [
      [max, corners],
      [min, [...corners].reverse()],
    ]) {
      const quad = order.map(([a, b]) => {
        const point = [];
        point[axis] = side[axis];
        point[p] = a;
        point[q] = b;
        return point;
      });
      triangles.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]);
    }
  }
  return triangles;
}

test('diện tích giao của hai tam giác chỉ chạm mép bằng không', () => {
  const left = [
    [0, 0],
    [1, 0],
    [1, 1],
  ];
  const right = [
    [1, 0],
    [2, 0],
    [2, 1],
  ];
  assert.equal(overlapArea(left, right), 0);
  assert.ok(Math.abs(overlapArea(left, left) - 0.5) < 1e-12);
});

test('hộp đặt chồng lên hộp khác không bị báo vì hai mặt chạm nhau quay ngược chiều', () => {
  const placements = [
    { label: 'base', triangles: box([0, 1], [0, 1], [0, 1]) },
    { label: 'top', triangles: box([0, 1], [1, 2], [0, 1]) },
  ];
  assert.deepEqual(coplanarOverlaps(placements), []);
});

test('hai hộp kề nhau chung một mép không bị báo', () => {
  const placements = [
    { label: 'a', triangles: box([0, 1], [0, 1], [0, 1]) },
    { label: 'b', triangles: box([1, 2], [0, 1], [0, 1]) },
  ];
  assert.deepEqual(coplanarOverlaps(placements), []);
});

test('hai hộp cùng dán đáy lên một hộp nền không bị báo vì mặt đáy đã bị chôn', () => {
  const base = box([-1, 1], [0, 1], [-1, 1]);
  const first = box([-0.5, 0.5], [1, 2], [-0.5, 0.5]);
  const second = box([0, 0.8], [1, 1.5], [0, 0.8]);
  const exposed = coplanarOverlaps([{ label: 'pair', triangles: [...first, ...second] }]);
  assert.ok(exposed.some((item) => item.axis === 'y' && item.sign === '-'));
  const buried = coplanarOverlaps([{ label: 'stack', triangles: [...base, ...first, ...second] }]);
  assert.deepEqual(buried, []);
});

test('tấm mỏng bằng không dán lên mặt bàn bị báo vì mặt che thuộc chính khối đó', () => {
  const desk = box([-0.5, 0.5], [0, 0.7], [-0.3, 0.3]);
  const skin = box([0.1, 0.2], [0.7, 0.7], [0.1, 0.2]);
  const overlaps = coplanarOverlaps([{ label: 'desk_a', triangles: [...desk, ...skin] }]);
  assert.ok(overlaps.some((item) => item.axis === 'y' && item.sign === '+'));
});

test('hai mặt cùng hướng cách nhau dưới 1,5 mm bị báo, cách 3 mm thì không', () => {
  const desk = box([-0.5, 0.5], [0, 0.7], [-0.3, 0.3]);
  const near = box([0.1, 0.2], [0.7, 0.7005], [0.1, 0.2]);
  const clear = box([0.1, 0.2], [0.7, 0.703], [0.1, 0.2]);
  const flagged = coplanarOverlaps([{ label: 'desk_a', triangles: [...desk, ...near] }]);
  assert.ok(flagged.some((item) => item.axis === 'y' && item.sign === '+' && item.gap > 0));
  assert.deepEqual(coplanarOverlaps([{ label: 'desk_a', triangles: [...desk, ...clear] }]), []);
});

test('trụ ốp cao hết tường có mặt trên trùng phẳng với dải băng trần thì bị báo', () => {
  const pilaster = box([0.88, 1], [0, 3], [-0.8, -0.7]);
  const band = box([-1, 1], [2.6, 3], [-0.8, -0.68]);
  const overlaps = coplanarOverlaps([{ label: 'wall_a', triangles: [...pilaster, ...band] }]);
  const top = overlaps.filter((item) => item.axis === 'y' && item.sign === '+');
  assert.ok(top.length > 0, 'mặt trên phải bị báo');
  const area = top.reduce((sum, item) => sum + item.area, 0);
  assert.ok(Math.abs(area - 0.12 * 0.1) < 1e-6, `diện tích chồng ${area}`);
  assert.ok(Math.abs(top[0].coord - 3) < 1e-9);
});

test('ghép cụm chỉ báo cặp giữa hai món khác nhau khi được yêu cầu', () => {
  const wall = box([-1, 1], [0, 3], [-1, -0.8]);
  const placements = [
    { label: 'wall#1', triangles: placeTriangles(wall, [0, 0, 0], 0) },
    { label: 'wall#2', triangles: placeTriangles(wall, [0, 0, 0], 0) },
  ];
  const across = coplanarOverlaps(placements, { acrossOnly: true });
  assert.ok(across.length > 0);
  assert.ok(across.every((item) => item.labels[0] !== item.labels[1]));
  const sideBySide = [
    { label: 'wall#1', triangles: placeTriangles(wall, [-1, 0, 0], 0) },
    { label: 'wall#2', triangles: placeTriangles(wall, [1, 0, 0], 0) },
  ];
  assert.deepEqual(coplanarOverlaps(sideBySide, { acrossOnly: true }), []);
});

test('xoay quanh trục đứng giữ nguyên chiều cao và đưa cạnh tường sang trục kia', () => {
  const [triangle] = placeTriangles(
    [
      [
        [1, 0, 0],
        [1, 2, 0],
        [1, 0, 1],
      ],
    ],
    [0, 0, 0],
    -Math.PI / 2,
  );
  assert.ok(Math.abs(triangle[0][2] - 1) < 1e-9);
  assert.ok(Math.abs(triangle[1][1] - 2) < 1e-9);
});

test('bộ phòng sinh ra đủ cụm ghép cho mỗi biến thể tường', () => {
  const names = roomAssemblies(['wall_a', 'corner_a', 'door_a', 'window_a', 'floor_a']).map(
    (item) => item.name,
  );
  assert.deepEqual(names, [
    'wall_a beside wall_a',
    'corner_a with wall_a',
    'door_a between wall_a',
    'window_a between wall_a',
  ]);
  assert.deepEqual(roomAssemblies(['chair_a']), []);
});

test('mặt tiền nhà ống được ghép thành nhà ba tầng với mỗi mẫu lầu và hai căn kề nhau', () => {
  const assemblies = facadeAssemblies(['shopfront_a', 'storey_a', 'storey_b', 'roof_a', 'road_a']);
  assert.deepEqual(
    assemblies.map((item) => item.name),
    [
      'shopfront_a under storey_a under storey_a under roof_a',
      'shopfront_a under storey_a under storey_b under roof_a',
      'shopfront_a under storey_b under storey_a under roof_a',
      'shopfront_a under storey_b under storey_b under roof_a',
      'shopfront_a beside shopfront_a',
      'storey_a beside storey_a',
      'storey_b beside storey_b',
      'roof_a beside roof_a',
    ],
  );
  assert.deepEqual(
    assemblies[0].places.map(([, offset]) => offset[1]),
    [0, 3.8, 7.6, 11.4],
  );
  assert.deepEqual(facadeAssemblies(['wall_a']), []);
});

test('bộ phòng thật không có mặt trùng phẳng chồng nhau, kể cả ở các cụm ghép', (context) => {
  const config = loadConfig(ROOT);
  const kit = config.kits.find((item) => item.file === 'room-kit.glb');
  const buffer = readFileSync(join(ROOT, 'exported', kit.file));
  if (isLfsPointer(buffer)) return context.skip('room-kit.glb chưa tải nội dung LFS');
  const parts = Object.entries(kit.slots).flatMap(([slot, spec]) =>
    spec.variants.map((variant) => `${slot}_${variant}`),
  );
  const gltf = readGlb(buffer);
  const errors = checkCoplanar(gltf, readGlbBinary(buffer), parts, roomAssemblies(parts));
  assert.deepEqual(errors, []);
});
