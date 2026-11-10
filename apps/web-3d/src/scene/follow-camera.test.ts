import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CEILING_CUT_HEIGHT,
  DEFAULT_ORBIT,
  LOOK_HEIGHT,
  MAX_DISTANCE,
  MAX_PITCH,
  MIN_DISTANCE,
  MIN_PITCH,
  cameraPose,
  cutaways,
  turnOrbit,
  zoomOrbit,
} from './follow-camera.ts';
import type { CameraPose, CutPlane, Point3 } from './follow-camera.ts';

const ROOM = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };
const LEVEL = { yaw: 0, pitch: 0, distance: 3 };

function span(pose: CameraPose): number {
  const [ex, ey, ez] = pose.eye;
  const [tx, ty, tz] = pose.target;
  return Math.sqrt((ex - tx) ** 2 + (ey - ty) ** 2 + (ez - tz) ** 2);
}

function close(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} is not ${expected}`);
}

function kept(planes: readonly CutPlane[], [x, y, z]: Point3): boolean {
  return planes.every(([nx, ny, nz, constant]) => nx * x + ny * y + nz * z + constant >= 0);
}

test('camera nhìn vào thân nhân vật và đứng ngay sau lưng theo hướng nhìn', () => {
  const pose = cameraPose({ x: 1, z: 2 }, LEVEL);
  assert.deepEqual(pose.target, [1, LOOK_HEIGHT, 2]);
  close(pose.eye[0], 1, 'x');
  close(pose.eye[1], LOOK_HEIGHT, 'y');
  close(pose.eye[2], -1, 'z');
});

test('quay camera sang đông thì camera lùi về phía tây của nhân vật', () => {
  const pose = cameraPose({ x: 0, z: 0 }, { ...LEVEL, yaw: Math.PI / 2 });
  close(pose.eye[0], -3, 'x');
  close(pose.eye[2], 0, 'z');
});

test('ngẩng camera lên thì vẫn giữ đúng khoảng cách tới nhân vật', () => {
  const pose = cameraPose({ x: 0, z: 0 }, { ...LEVEL, distance: 7, pitch: 0.9 });
  close(span(pose), 7, 'distance');
  close(pose.eye[1], LOOK_HEIGHT + 7 * Math.sin(0.9), 'y');
  assert.ok(pose.eye[2] > -7 && pose.eye[2] < 0, `eye z ${pose.eye[2]}`);
});

test('nhân vật đứng sát tường thì camera vẫn giữ nguyên khoảng cách, lùi hẳn ra ngoài phòng', () => {
  const pose = cameraPose({ x: 0, z: -1.7 }, { ...DEFAULT_ORBIT, pitch: MIN_PITCH });
  close(span(pose), DEFAULT_ORBIT.distance, 'distance');
  assert.ok(pose.eye[2] < ROOM.minZ, `eye z ${pose.eye[2]}`);
});

test('góc nhìn mặc định là góc rộng từ trên cao, thấy được cả gian phòng', () => {
  const pose = cameraPose({ x: 0, z: 0 }, DEFAULT_ORBIT);
  assert.ok(pose.eye[1] > CEILING_CUT_HEIGHT, `eye y ${pose.eye[1]}`);
  assert.ok(DEFAULT_ORBIT.distance >= 10);
});

test('camera ở trong phòng và dưới trần thì không cắt gì', () => {
  const planes = cutaways([0, 1.5, 0], ROOM);
  assert.equal(planes.length, 5);
  for (const point of [
    [3.1, 1, 0],
    [-3.1, 1, 0],
    [0, 1, 2.1],
    [0, 1, -2.1],
    [0, 2.9, 0],
  ] as const) {
    assert.equal(kept(planes, point), true, `${point}`);
  }
});

test('camera ra ngoài tường nào thì tường đó bị cắt, ba tường còn lại và trần giữ nguyên', () => {
  const sides: [Point3, Point3][] = [
    [
      [5, 1.5, 0],
      [3.1, 1, 0],
    ],
    [
      [-5, 1.5, 0],
      [-3.1, 1, 0],
    ],
    [
      [0, 1.5, 4],
      [0, 1, 2.1],
    ],
    [
      [0, 1.5, -4],
      [0, 1, -2.1],
    ],
  ];
  const walls = sides.map(([, wall]) => wall);
  for (const [eye, cut] of sides) {
    const planes = cutaways(eye, ROOM);
    for (const wall of walls) {
      assert.equal(kept(planes, wall), wall !== cut, `eye ${eye} wall ${wall}`);
    }
    assert.equal(kept(planes, [0, 2.9, 0]), true, `ceiling from ${eye}`);
  }
});

test('camera ở góc ngoài phòng thì cắt cả hai tường kề góc đó', () => {
  const planes = cutaways([5, 1.5, 4], ROOM);
  assert.equal(kept(planes, [3.1, 1, 0]), false);
  assert.equal(kept(planes, [0, 1, 2.1]), false);
  assert.equal(kept(planes, [-3.1, 1, 0]), true);
  assert.equal(kept(planes, [0, 1, -2.1]), true);
});

test('camera cao hơn trần thì trần bị cắt, mọi thứ trong lòng phòng vẫn còn', () => {
  const planes = cutaways([0, 5, 0], ROOM);
  assert.equal(kept(planes, [0, 2.9, 0]), false);
  for (const point of [
    [0, 0, 0],
    [2.9, 1.2, 1.9],
    [-2.9, 2.5, -1.9],
  ] as const) {
    assert.equal(kept(planes, point), true, `${point}`);
  }
});

test('nhân vật và đồ trong lòng phòng không bao giờ bị cắt dù camera ở đâu', () => {
  for (const eye of [
    [9, 6, 9],
    [-9, 0.5, 0],
    [0, 9, -9],
    [3.0001, 2.6001, 2.0001],
  ] as const) {
    const planes = cutaways(eye, ROOM);
    for (const point of [
      [0, 1, 0],
      [3, 0, 2],
      [-3, CEILING_CUT_HEIGHT, -2],
    ] as const) {
      assert.equal(kept(planes, point), true, `eye ${eye} point ${point}`);
    }
  }
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
  const low = cameraPose({ x: 0, z: 0 }, { ...DEFAULT_ORBIT, pitch: MIN_PITCH });
  assert.ok(low.eye[1] > LOOK_HEIGHT);
});

test('lăn chuột ra thì camera lùi xa, lăn vào thì lại gần, hướng nhìn giữ nguyên', () => {
  const out = zoomOrbit(DEFAULT_ORBIT, 2);
  const back = zoomOrbit(out, -2);
  assert.ok(out.distance > DEFAULT_ORBIT.distance);
  close(back.distance, DEFAULT_ORBIT.distance, 'distance');
  assert.equal(out.yaw, DEFAULT_ORBIT.yaw);
  assert.equal(out.pitch, DEFAULT_ORBIT.pitch);
});

test('khoảng cách camera bị chặn ở hai đầu', () => {
  assert.equal(zoomOrbit(DEFAULT_ORBIT, 1000).distance, MAX_DISTANCE);
  assert.equal(zoomOrbit(DEFAULT_ORBIT, -1000).distance, MIN_DISTANCE);
});

test('số đo kéo hoặc lăn hỏng thì giữ nguyên góc nhìn', () => {
  assert.deepEqual(turnOrbit(DEFAULT_ORBIT, Number.NaN, 5), DEFAULT_ORBIT);
  assert.deepEqual(turnOrbit(DEFAULT_ORBIT, 5, Infinity), DEFAULT_ORBIT);
  assert.deepEqual(zoomOrbit(DEFAULT_ORBIT, Number.NaN), DEFAULT_ORBIT);
});

test('camera hạ thấp và lại gần hết cỡ vẫn cao hơn trần, nên không bao giờ chui vào giữa bàn ghế', () => {
  const lowest = zoomOrbit(turnOrbit(DEFAULT_ORBIT, 0, -100000), -1000);
  for (const yaw of [0, 1, 2.5, -2]) {
    const pose = cameraPose({ x: 0, z: 0 }, { ...lowest, yaw });
    assert.ok(pose.eye[1] > CEILING_CUT_HEIGHT + 1.5, `yaw ${yaw}: eye at ${pose.eye[1]}`);
  }
});
