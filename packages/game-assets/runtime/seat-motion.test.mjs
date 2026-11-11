import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEAT_PULL,
  chairComesHome,
  seatMotion,
  seatMotionLength,
  slideBack,
} from './seat-motion.mjs';

const CLIPS = { sit_down: 1.2, stand_up: 1.0 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual}`);

test('lúc ngồi: ghế trượt ra trước, nhân vật chưa nhúc nhích và ghế chưa có người', () => {
  const start = seatMotion('sit', 0, CLIPS);
  assert.deepEqual(start, { chair: 0, actor: null, clip: null, done: false });
  const mid = seatMotion('sit', 0.2, CLIPS);
  assert.ok(mid.chair > 0 && mid.chair < SEAT_PULL);
  assert.equal(mid.actor, null);
});

test('lúc ngồi: ghế ra hết thì nhân vật vào chỗ đã lùi và chạy hành động ngồi xuống', () => {
  const sitting = seatMotion('sit', 0.45 + 0.6, CLIPS);
  near(sitting.chair, SEAT_PULL);
  near(sitting.actor, SEAT_PULL);
  assert.equal(sitting.clip, 'sit_down');
  assert.equal(sitting.done, false);
});

test('lúc ngồi: ngồi xong thì ghế và nhân vật cùng trượt vào, tới nơi mới gõ phím', () => {
  const sliding = seatMotion('sit', 0.45 + 1.2 + 0.25, CLIPS);
  assert.ok(sliding.chair > 0 && sliding.chair < SEAT_PULL);
  near(sliding.actor, sliding.chair);
  assert.equal(sliding.clip, 'sit_idle');
  const end = seatMotion('sit', seatMotionLength('sit', CLIPS), CLIPS);
  assert.deepEqual(end, { chair: 0, actor: 0, clip: 'typing', done: true });
  assert.equal(seatMotion('sit', 99, CLIPS).done, true);
});

test('lúc rời máy: ghế và nhân vật cùng trượt ra, rồi mới đứng dậy ở chỗ đã lùi', () => {
  const start = seatMotion('stand', 0, CLIPS);
  assert.deepEqual(start, { chair: 0, actor: 0, clip: 'sit_idle', done: false });
  const out = seatMotion('stand', 0.55 + 0.5, CLIPS);
  near(out.chair, SEAT_PULL);
  near(out.actor, SEAT_PULL);
  assert.equal(out.clip, 'stand_up');
  const end = seatMotion('stand', seatMotionLength('stand', CLIPS), CLIPS);
  assert.deepEqual(end, { chair: SEAT_PULL, actor: SEAT_PULL, clip: 'idle', done: true });
});

test('độ dài trình tự tính theo độ dài thật của hành động', () => {
  near(seatMotionLength('sit', CLIPS), 0.45 + 1.2 + 0.55);
  near(seatMotionLength('stand', CLIPS), 0.55 + 1.0);
  near(seatMotionLength('sit', { sit_down: 2, stand_up: 1 }), 0.45 + 2 + 0.55);
});

test('ghế trượt êm: không giật ở đầu và cuối, không vượt quá quãng kéo', () => {
  let previous = 0;
  for (let step = 0; step <= 45; step += 1) {
    const { chair } = seatMotion('sit', step / 100, CLIPS);
    assert.ok(chair >= previous - 1e-9 && chair <= SEAT_PULL + 1e-9);
    previous = chair;
  }
  assert.ok(seatMotion('sit', 0.01, CLIPS).chair < SEAT_PULL * 0.01);
});

test('lùi ra là đi ngược hướng mặt ghế, ghế quay hướng nào thì lùi theo hướng đó', () => {
  const [x0, z0] = slideBack(0, 0.4);
  near(x0, 0);
  near(z0, -0.4);
  const [x1, z1] = slideBack(Math.PI / 2, 0.4);
  near(x1, -0.4);
  near(z1, 0);
  const [x2, z2] = slideBack(Math.PI, 0.4);
  near(x2, 0);
  near(z2, 0.4);
});

test('ghế chỉ trượt về chỗ cũ lúc người chơi đã đi khỏi, để không đẩy xuyên qua họ', () => {
  assert.equal(chairComesHome({ x: 0, z: 0 }, { x: 0.2, z: 0.1 }), false);
  assert.equal(chairComesHome({ x: 0, z: 0 }, { x: 0.9, z: 0 }), true);
  assert.equal(chairComesHome({ x: 1, z: 1 }, { x: 1, z: 1.7 }), false);
  assert.equal(chairComesHome({ x: 1, z: 1 }, { x: 1, z: 1.9 }), true);
});
