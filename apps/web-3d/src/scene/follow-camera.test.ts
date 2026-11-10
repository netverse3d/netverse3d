import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CAMERA_WALL_MARGIN,
  DEFAULT_ORBIT,
  LOOK_HEIGHT,
  MAX_EYE_HEIGHT,
  MAX_PITCH,
  MIN_PITCH,
  cameraPose,
  turnOrbit,
} from './follow-camera.ts';
import type { CameraPose } from './follow-camera.ts';

const OPEN = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
const ROOM = { minX: -3, maxX: 3, minZ: -3, maxZ: 3 };
const LEVEL = { yaw: 0, pitch: 0, distance: 3 };

function span(pose: CameraPose): number {
  const [ex, ey, ez] = pose.eye;
  const [tx, ty, tz] = pose.target;
  return Math.sqrt((ex - tx) ** 2 + (ey - ty) ** 2 + (ez - tz) ** 2);
}

function close(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} is not ${expected}`);
}

test('camera nhìn vào tầm ngực nhân vật và đứng ngay sau lưng theo hướng nhìn', () => {
  const pose = cameraPose({ x: 1, z: 2 }, LEVEL, OPEN);
  assert.deepEqual(pose.target, [1, LOOK_HEIGHT, 2]);
  close(pose.eye[0], 1, 'x');
  close(pose.eye[1], LOOK_HEIGHT, 'y');
  close(pose.eye[2], -1, 'z');
});

test('quay camera sang đông thì camera lùi về phía tây của nhân vật', () => {
  const pose = cameraPose({ x: 0, z: 0 }, { ...LEVEL, yaw: Math.PI / 2 }, OPEN);
  close(pose.eye[0], -3, 'x');
  close(pose.eye[2], 0, 'z');
});

test('ngẩng camera lên thì vẫn giữ đúng khoảng cách tới nhân vật', () => {
  const pose = cameraPose({ x: 0, z: 0 }, { ...LEVEL, distance: 2, pitch: 0.5 }, OPEN);
  close(span(pose), 2, 'distance');
  close(pose.eye[1], LOOK_HEIGHT + 2 * Math.sin(0.5), 'y');
  assert.ok(pose.eye[2] > -2 && pose.eye[2] < 0, `eye z ${pose.eye[2]}`);
});

test('camera không vượt trần phòng dù ngẩng hết cỡ', () => {
  const pose = cameraPose({ x: 0, z: 0 }, { ...LEVEL, distance: 6, pitch: MAX_PITCH }, OPEN);
  assert.equal(pose.eye[1], MAX_EYE_HEIGHT);
});

test('nhân vật đứng gần tường thì camera dừng ở tường và trượt lên cao, không lọt ra ngoài phòng', () => {
  const pose = cameraPose({ x: 0, z: -2 }, { ...LEVEL, distance: 1.4 }, ROOM);
  close(pose.eye[2], -3 + CAMERA_WALL_MARGIN, 'z');
  close(pose.eye[0], 0, 'x');
  close(span(pose), 1.4, 'distance');
  assert.ok(pose.eye[1] > LOOK_HEIGHT && pose.eye[1] <= MAX_EYE_HEIGHT, `eye y ${pose.eye[1]}`);
});

test('quay lưng sát tường thì camera vẫn cách nhân vật một quãng, không chui vào người', () => {
  for (const yaw of [0, 0.4, Math.PI / 2, 2.5, Math.PI, -1.1, -Math.PI / 2]) {
    for (const [x, z] of [
      [2.7, 2.7],
      [-2.7, 2.7],
      [2.7, -2.7],
      [-2.7, -2.7],
      [0, -2.7],
      [2.7, 0],
    ] as const) {
      const pose = cameraPose({ x, z }, { ...DEFAULT_ORBIT, yaw }, ROOM);
      assert.ok(span(pose) >= 1, `yaw ${yaw} at ${x},${z}: camera is ${span(pose)} away`);
      assert.ok(pose.eye[0] >= ROOM.minX + CAMERA_WALL_MARGIN - 1e-9, 'west wall');
      assert.ok(pose.eye[0] <= ROOM.maxX - CAMERA_WALL_MARGIN + 1e-9, 'east wall');
      assert.ok(pose.eye[2] >= ROOM.minZ + CAMERA_WALL_MARGIN - 1e-9, 'north wall');
      assert.ok(pose.eye[2] <= ROOM.maxZ - CAMERA_WALL_MARGIN + 1e-9, 'south wall');
      assert.ok(pose.eye[1] <= MAX_EYE_HEIGHT, 'ceiling');
    }
  }
});

test('nhân vật đứng sát tường hơn cả lề camera thì camera lên ngay trên đầu, không lộn ra trước', () => {
  const pose = cameraPose({ x: 0, z: -2.95 }, LEVEL, ROOM);
  close(pose.eye[2], -2.95, 'z');
  assert.equal(pose.eye[1], MAX_EYE_HEIGHT);
});

test('kéo chuột sang phải thì camera nhìn sang phải, kéo xuống thì nhìn xuống', () => {
  const turned = turnOrbit(DEFAULT_ORBIT, 100, 0);
  assert.ok(turned.yaw < DEFAULT_ORBIT.yaw);
  assert.equal(turned.pitch, DEFAULT_ORBIT.pitch);
  const tilted = turnOrbit(DEFAULT_ORBIT, 0, 40);
  assert.ok(tilted.pitch > DEFAULT_ORBIT.pitch);
  assert.equal(tilted.yaw, DEFAULT_ORBIT.yaw);
  assert.equal(tilted.distance, DEFAULT_ORBIT.distance);
});

test('góc ngẩng bị chặn ở hai đầu, không lộn qua đỉnh đầu hay chui xuống sàn', () => {
  assert.equal(turnOrbit(DEFAULT_ORBIT, 0, 100000).pitch, MAX_PITCH);
  assert.equal(turnOrbit(DEFAULT_ORBIT, 0, -100000).pitch, MIN_PITCH);
});

test('số đo kéo hỏng thì giữ nguyên góc nhìn', () => {
  assert.deepEqual(turnOrbit(DEFAULT_ORBIT, Number.NaN, 5), DEFAULT_ORBIT);
  assert.deepEqual(turnOrbit(DEFAULT_ORBIT, 5, Infinity), DEFAULT_ORBIT);
});
