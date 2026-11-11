import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CLEARANCE_LEVELS,
  clearance,
  collisionOutlines,
  footZoneHits,
  handReading,
  seatedClips,
  seatPoint,
  stationChoices,
  withVariant,
} from '../library/shared/checks-data.mjs';
import { kitAnchors, stationPlan } from '../runtime/shop-look.mjs';
import { partTriangles } from './coplanar.mjs';
import { isLfsPointer, loadConfig, readGlb, readGlbBinary } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual}`);

const CONFIG = {
  kits: [
    {
      file: 'station-parts.glb',
      slots: {
        desk: { variants: ['a', 'b'] },
        chair: { variants: ['a'] },
        speaker: { variants: ['a', 'b'] },
      },
    },
    { file: 'room-kit.glb', slots: { wall: { variants: ['a', 'b'] } } },
  ],
};

test('trang soi lỗi chỉ cho chọn mẫu của các ô thuộc bộ bàn máy, theo thứ tự trong cấu hình', () => {
  assert.deepEqual(stationChoices(CONFIG), [
    { slot: 'desk', variants: ['a', 'b'] },
    { slot: 'chair', variants: ['a'] },
    { slot: 'speaker', variants: ['a', 'b'] },
  ]);
  assert.deepEqual(stationChoices({}), []);
});

test('đổi mẫu của một ô tạo bộ lựa chọn mới, không sửa bộ của tiệm', () => {
  const variants = { desk: 'a', chair: 'a' };
  assert.deepEqual(withVariant(variants, 'desk', 'b'), { desk: 'b', chair: 'a' });
  assert.deepEqual(variants, { desk: 'a', chair: 'a' });
});

test('chỗ ngồi là vị trí ghế cộng điểm neo ngồi của ghế, cùng hướng với ghế', () => {
  const chair = { position: [0, 0, -0.24], yaw: 0 };
  const hip = { position: [0, 0, 0.24] };
  assert.deepEqual(seatPoint(chair, hip), { x: 0, z: 0, yaw: 0 });
});

test('ghế xoay thì điểm neo ngồi xoay theo ghế', () => {
  const hip = { position: [0.1, 0, 0.2] };
  const quarter = seatPoint({ position: [1, 0, 2], yaw: Math.PI / 2 }, hip);
  near(quarter.x, 1.2);
  near(quarter.z, 1.9);
  near(quarter.yaw, Math.PI / 2);
  const half = seatPoint({ position: [1, 0, 2], yaw: Math.PI }, hip);
  near(half.x, 0.9);
  near(half.z, 1.8);
});

test('hộp va chạm lấy từ mọi điểm neo collision của các món đã lắp, đặt theo vị trí món', () => {
  const plan = [
    { slot: 'desk', part: 'desk_a', position: [0, 0, 0], yaw: 0 },
    { slot: 'chair', part: 'chair_a', position: [0, 0, -0.24], yaw: 0 },
    { slot: 'mouse', part: 'mouse_a', position: [0.3, 0.7, 0.2], yaw: 0 },
  ];
  const anchors = {
    desk_a: {
      collision_main: { position: [0, 0.36, 0.46], scale: [0.76, 0.36, 0.35] },
      socket_chair: { position: [0, 0, -0.24], scale: [1, 1, 1] },
    },
    chair_a: {
      collision_main: { position: [0, 0.665, -0.03], scale: [0.32, 0.665, 0.33] },
      collision_arm: { position: [0.3, 0.6, 0], scale: [0.03, 0.02, 0.2] },
    },
  };
  const boxes = collisionOutlines(plan, anchors);
  assert.deepEqual(
    boxes.map((box) => `${box.part}:${box.name}`),
    ['desk_a:collision_main', 'chair_a:collision_main', 'chair_a:collision_arm'],
  );
  assert.deepEqual(boxes[0].center, [0, 0.36, 0.46]);
  assert.deepEqual(boxes[0].half, [0.76, 0.36, 0.35]);
  near(boxes[1].center[2], -0.27);
});

test('hộp va chạm của món đã xoay thì tâm xoay theo món', () => {
  const plan = [{ slot: 'chair', part: 'chair_a', position: [1, 0, 1], yaw: Math.PI / 2 }];
  const anchors = {
    chair_a: { collision_main: { position: [0, 0.5, 0.2], scale: [0.3, 0.5, 0.3] } },
  };
  const [box] = collisionOutlines(plan, anchors);
  near(box.center[0], 1.2);
  near(box.center[2], 1);
  near(box.yaw, Math.PI / 2);
});

test('khoảng hở xếp ba mức: lún vào bề mặt, sát bề mặt, cách xa quá mức cho phép', () => {
  assert.deepEqual(CLEARANCE_LEVELS, ['sunk', 'touching', 'floating']);
  assert.deepEqual(clearance(0.71, 0.72), { millimetres: -10, level: 'sunk' });
  assert.equal(clearance(0.7195, 0.72).level, 'touching');
  assert.equal(clearance(0.75, 0.72).level, 'touching');
  assert.deepEqual(clearance(0.9, 0.72, 0.06), { millimetres: 180, level: 'floating' });
  assert.equal(clearance(0.72, 0.72).millimetres, 0);
});

test('tay ở trên bàn phím thì đo tới mặt phím, ở ngoài thì đo tới mặt bàn, đặt trên đùi thì không tính là lún', () => {
  const keyboard = { x: 0, z: 0.26, halfWidth: 0.25, halfDepth: 0.12, height: 0.74 };
  assert.deepEqual(handReading({ x: 0.1, y: 0.73, z: 0.3 }, keyboard, 0.708), {
    surface: 'keyboard',
    millimetres: -10,
    level: 'sunk',
  });
  assert.deepEqual(handReading({ x: 0.5, y: 0.72, z: 0.3 }, keyboard, 0.708), {
    surface: 'desk',
    millimetres: 12,
    level: 'touching',
  });
  assert.deepEqual(handReading({ x: 0.2, y: 0.6, z: -0.1 }, keyboard, 0.708), {
    surface: 'desk',
    millimetres: null,
    level: 'away',
  });
  assert.equal(handReading({ x: 0.5, y: 0.68, z: 0.3 }, keyboard, 0.708).level, 'sunk');
});

test('tư thế để soi là các hành động ngồi có trong cấu hình, ngồi gõ phím đứng đầu', () => {
  assert.deepEqual(seatedClips(['idle', 'sit_down', 'typing', 'walk', 'sit_idle', 'stand_up']), [
    'typing',
    'sit_idle',
    'sit_down',
    'stand_up',
  ]);
  assert.deepEqual(seatedClips(['idle', 'walk']), []);
});

test('bộ máy thật: nhân vật ngồi đúng chỗ game đặt, ngay trước ghế và quay về phía bàn', (context) => {
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const anchors = kitAnchors(readGlb(buffer));
  const config = loadConfig(ROOT);
  const variants = Object.fromEntries(
    stationChoices(config).map((choice) => [choice.slot, choice.variants[0]]),
  );
  const plan = stationPlan(variants, anchors);
  const chair = plan.find((placed) => placed.slot === 'chair');
  const seat = seatPoint({ ...chair, yaw: 0 }, anchors[chair.part].seat_anchor);
  near(seat.x, chair.position[0]);
  assert.ok(seat.z > chair.position[2], 'the seat anchor sits in front of the chair origin');
  const boxes = collisionOutlines(
    plan.map((placed) => ({ ...placed, yaw: 0 })),
    anchors,
  );
  assert.ok(boxes.some((box) => box.part.startsWith('desk_')));
  assert.ok(boxes.some((box) => box.part.startsWith('chair_')));
  assert.ok(boxes.some((box) => box.part.startsWith('case_')));
});

test('vùng đặt chân nằm trước điểm ngồi, hai bên trục ghế, sát sàn', () => {
  const hip = { position: [0, 0, 0.24] };
  const inside = [
    [0.115, 0.05, 0.3],
    [0.3, 0.05, 0.3],
    [0.3, 0.05, 0.5],
  ];
  const between = [
    [0, 0.05, 0.3],
    [0.02, 0.05, 0.35],
    [-0.02, 0.05, 0.35],
  ];
  const above = [
    [0.115, 0.3, 0.3],
    [0.12, 0.3, 0.32],
    [0.1, 0.3, 0.32],
  ];
  const behind = [
    [0.115, 0.05, 0.05],
    [0.12, 0.05, 0.06],
    [0.1, 0.05, 0.06],
  ];
  assert.equal(footZoneHits([inside, between, above, behind], hip), 1);
  assert.equal(footZoneHits([inside.map(([x, y, z]) => [-x, y, z])], hip), 1);
  assert.equal(footZoneHits([], hip), 0);
});

test('bộ máy thật: không phần nào của ghế nằm trong vùng đặt hai bàn chân', (context) => {
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const gltf = readGlb(buffer);
  const anchors = kitAnchors(gltf);
  const chairs = loadConfig(ROOT).kits.find((kit) => kit.file === 'station-parts.glb').slots.chair;
  for (const variant of chairs.variants) {
    const part = `chair_${variant}`;
    const triangles = partTriangles(gltf, readGlbBinary(buffer), part);
    assert.ok(triangles.length > 0, part);
    assert.equal(footZoneHits(triangles, anchors[part].seat_anchor), 0, part);
  }
});
