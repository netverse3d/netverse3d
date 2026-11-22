import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SHOP_VIEWPOINTS,
  catmullRomDerivative,
  catmullRomPoint,
  createCameraTrack,
  getShopViewpoints,
  normalizeVector,
} from './camera-track.mjs';

test('catmullRomPoint nội suy chính xác tại các điểm mốc và mượt ở giữa', () => {
  const p0 = [0, 0, 0];
  const p1 = [2, 1, 0];
  const p2 = [4, 3, 2];
  const p3 = [6, 2, 4];

  const atStart = catmullRomPoint(p0, p1, p2, p3, 0);
  assert.deepEqual(atStart, p1);

  const atEnd = catmullRomPoint(p0, p1, p2, p3, 1);
  assert.deepEqual(atEnd, p2);

  const atMid = catmullRomPoint(p0, p1, p2, p3, 0.5);
  assert.ok(atMid[0] > p1[0] && atMid[0] < p2[0]);
  assert.ok(atMid[1] > p1[1] && atMid[1] < p2[1]);
});

test('catmullRomDerivative tính đạo hàm vận tốc phù hợp với hướng tiếp tuyến', () => {
  const p0 = [0, 0, 0];
  const p1 = [1, 0, 0];
  const p2 = [2, 0, 0];
  const p3 = [3, 0, 0];

  const derivStart = catmullRomDerivative(p0, p1, p2, p3, 0);
  assert.equal(derivStart[0], 1.0);
  assert.equal(derivStart[1], 0.0);
  assert.equal(derivStart[2], 0.0);
});

test('normalizeVector chuẩn hoá vector về độ dài 1 hoặc trả mặc định nếu độ dài bằng 0', () => {
  const zero = normalizeVector([0, 0, 0]);
  assert.deepEqual(zero, [0, 0, 1]);

  const v = normalizeVector([3, 4, 0]);
  assert.equal(Math.round(Math.hypot(...v)), 1);
  assert.equal(v[0], 0.6);
  assert.equal(v[1], 0.8);
});

test('createCameraTrack kiểm tra số điểm tối thiểu và thời lượng hợp lệ', () => {
  assert.throws(() => createCameraTrack([]), RangeError);
  assert.throws(() => createCameraTrack([[0, 0, 0]]), RangeError);
  assert.throws(
    () =>
      createCameraTrack(
        [
          [0, 0, 0],
          [1, 1, 1],
        ],
        { duration: 0 },
      ),
    RangeError,
  );
});

test('mỗi tiệm mẫu đều có đúng 3 điểm nhìn mặc định với vị trí và mục tiêu ngắm', () => {
  assert.ok(DEFAULT_SHOP_VIEWPOINTS['tim-neon']);
  const recipes = ['tim-neon', 'bien-sau', 'cam-retro'];
  for (const id of recipes) {
    const viewpoints = getShopViewpoints(id);
    assert.equal(viewpoints.length, 3);
    for (const vp of viewpoints) {
      assert.equal(vp.position.length, 3);
      assert.equal(vp.target.length, 3);
      assert.ok(typeof vp.label === 'string' && vp.label.length > 0);
    }
  }
});

test('đường bay qua các góc nhìn tiệm mẫu không xuyên tường ở bất kỳ thời điểm nào', () => {
  const recipes = ['tim-neon', 'bien-sau', 'cam-retro'];
  for (const id of recipes) {
    const viewpoints = getShopViewpoints(id);
    const track = createCameraTrack(viewpoints, { duration: 18, loop: true });

    for (let step = 0; step <= 60; step += 1) {
      const t = (step / 60) * track.duration;
      const sample = track.sample(t);
      const [x, y, z] = sample.position;

      assert.ok(x > -2.6, `${id} x=${x} clips west wall at t=${t}`);
      assert.ok(z > -1.6, `${id} z=${z} clips north wall at t=${t}`);
      assert.ok(y >= 1.0 && y <= 4.2, `${id} y=${y} outside floor/ceiling height at t=${t}`);
    }
  }
});

test('createCameraTrack trả vị trí, mục tiêu, vector hướng, góc quay và độ dài', () => {
  const vps = [
    { position: [4, 3, 4], target: [0, 1, 0] },
    { position: [2, 1.5, 2], target: [-1, 1, -1] },
    { position: [3, 2, -1], target: [-1, 1, 0] },
  ];
  const track = createCameraTrack(vps, { duration: 12, loop: false });

  assert.equal(track.duration, 12);
  assert.equal(track.loop, false);
  assert.ok(track.approximateLength() > 0);

  const start = track.sample(0);
  assert.deepEqual(start.position, vps[0].position);
  assert.equal(start.done, false);
  assert.equal(start.progress, 0);

  const end = track.sample(12);
  assert.deepEqual(end.position, vps[2].position);
  assert.equal(end.done, true);
  assert.equal(end.progress, 1);

  const mid = track.sample(6);
  assert.equal(typeof mid.yaw, 'number');
  assert.equal(typeof mid.pitch, 'number');
  assert.equal(Math.round(Math.hypot(...mid.direction)), 1);
});

test('createCameraTrack dùng được với danh sách toạ độ thô không có mục tiêu sẵn', () => {
  const points = [
    [0, 1.6, 0],
    [4, 1.6, 0],
    [4, 1.6, 4],
    [0, 1.6, 4],
  ];
  const track = createCameraTrack(points, { duration: 16, loop: true });
  const sample = track.sample(4);

  assert.equal(sample.position.length, 3);
  assert.equal(sample.target.length, 3);
  assert.equal(Math.round(Math.hypot(...sample.direction)), 1);
  assert.equal(Math.round(Math.hypot(...sample.tangent)), 1);
});
