import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SEAT_PULL, seatMotionLength } from '@netverse/game-assets/runtime/seat-motion.mjs';

import { createSeatDrive } from './seat-drive.ts';
import type { SeatSpot } from './seat-drive.ts';

const CLIPS = { sit_down: 1.2, stand_up: 1 };
const SEAT: SeatSpot = { seatId: 'seat-1', sit: { x: 2, z: 3, yaw: 0 } };
const BESIDE = { x: 2.6, z: 2.4, yaw: 1 };
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not ${expected}`);

function sat() {
  const drive = createSeatDrive(CLIPS);
  drive.sit(SEAT, BESIDE);
  drive.step(seatMotionLength('sit', CLIPS) + 0.01, BESIDE);
  return drive;
}

test('chưa ai ngồi thì người chơi được tự do và không ghế nào bị dời', () => {
  const frame = createSeatDrive(CLIPS).step(0.1, BESIDE);
  assert.deepEqual(frame, { seat: null, chair: 0, hold: null, clip: null });
});

test('bắt đầu ngồi: ghế trượt ra, người chơi bị giữ lại và bước từ chỗ đang đứng vào trước ghế', () => {
  const drive = createSeatDrive(CLIPS);
  drive.sit(SEAT, BESIDE);
  const first = drive.step(0, BESIDE);
  assert.equal(first.seat, SEAT);
  assert.deepEqual(first.hold, BESIDE);
  assert.equal(first.clip, 'walk');
  const mid = drive.step(0.2, BESIDE);
  assert.ok(mid.chair > 0 && mid.chair < SEAT_PULL);
  assert.ok(mid.hold !== null && mid.hold.x < BESIDE.x && mid.hold.x > SEAT.sit.x);
});

test('ghế ra hết thì người chơi đứng ở chỗ đã lùi, quay mặt về bàn, và ngồi xuống', () => {
  const drive = createSeatDrive(CLIPS);
  drive.sit(SEAT, BESIDE);
  const frame = drive.step(0.45 + 0.5, BESIDE);
  near(frame.chair, SEAT_PULL);
  assert.equal(frame.clip, 'sit_down');
  near(frame.hold?.x ?? NaN, 2);
  near(frame.hold?.z ?? NaN, 3 - SEAT_PULL);
  near(frame.hold?.yaw ?? NaN, 0);
});

test('ngồi xong thì ghế và người chơi về sát bàn, giữ nguyên ở đó và gõ phím', () => {
  const drive = createSeatDrive(CLIPS);
  drive.sit(SEAT, BESIDE);
  const done = drive.step(seatMotionLength('sit', CLIPS) + 0.01, BESIDE);
  assert.deepEqual(done, { seat: SEAT, chair: 0, hold: SEAT.sit, clip: 'typing' });
  const later = drive.step(1, BESIDE);
  assert.deepEqual(later, { seat: SEAT, chair: 0, hold: SEAT.sit, clip: null });
  assert.equal(drive.seated(), true);
});

test('rời máy: trượt ra cùng ghế, đứng dậy ở chỗ đã lùi, rồi bước về chỗ đứng cũ', () => {
  const drive = sat();
  drive.stand();
  const sliding = drive.step(0.3, BESIDE);
  assert.equal(sliding.clip, 'sit_idle');
  assert.ok(sliding.chair > 0 && sliding.chair < SEAT_PULL);
  const rising = drive.step(0.55, BESIDE);
  assert.equal(rising.clip, 'stand_up');
  near(rising.hold?.z ?? NaN, 3 - SEAT_PULL);
  const stepping = drive.step(seatMotionLength('stand', CLIPS) - 0.85 + 0.15, BESIDE);
  assert.equal(stepping.clip, 'walk');
  near(stepping.chair, SEAT_PULL);
  assert.ok(stepping.hold !== null && stepping.hold.x > 2 && stepping.hold.x < BESIDE.x);
});

test('đứng dậy xong thì người chơi được thả ở chỗ đứng cũ, ghế còn để ngoài', () => {
  const drive = sat();
  drive.stand();
  const free = drive.step(seatMotionLength('stand', CLIPS) + 1, BESIDE);
  assert.equal(free.hold, null);
  assert.equal(free.seat, SEAT);
  near(free.chair, SEAT_PULL);
  assert.equal(drive.seated(), false);
});

test('người chơi đi khỏi thì ghế trượt về chỗ cũ rồi thôi không dời nữa', () => {
  const drive = sat();
  drive.stand();
  drive.step(seatMotionLength('stand', CLIPS) + 1, BESIDE);
  const stillNear = drive.step(0.5, { x: 2.3, z: 2.9, yaw: 0 });
  near(stillNear.chair, SEAT_PULL);
  const far = { x: 5, z: 5, yaw: 0 };
  const returning = drive.step(0.2, far);
  assert.ok(returning.chair > 0 && returning.chair < SEAT_PULL);
  const home = drive.step(1, far);
  assert.deepEqual(home, { seat: SEAT, chair: 0, hold: null, clip: null });
  assert.deepEqual(drive.step(0.1, far), { seat: null, chair: 0, hold: null, clip: null });
});

test('ghế quay hướng khác thì lùi ra theo hướng lưng ghế', () => {
  const drive = createSeatDrive(CLIPS);
  const east: SeatSpot = { seatId: 'seat-2', sit: { x: 0, z: 0, yaw: Math.PI / 2 } };
  drive.sit(east, { x: 0, z: 1, yaw: 0 });
  const frame = drive.step(0.45 + 0.5, { x: 0, z: 1, yaw: 0 });
  near(frame.hold?.x ?? NaN, -SEAT_PULL);
  near(frame.hold?.z ?? NaN, 0);
});

test('vào tiệm lúc đã có chỗ thì ngồi ngay, không chạy lại cảnh kéo ghế', () => {
  const drive = createSeatDrive(CLIPS);
  drive.seat(SEAT);
  assert.deepEqual(drive.step(0, BESIDE), { seat: SEAT, chair: 0, hold: SEAT.sit, clip: 'typing' });
  assert.equal(drive.seated(), true);
});

test('bị gọi rời máy lúc chưa ngồi thì không làm gì', () => {
  const drive = createSeatDrive(CLIPS);
  drive.stand();
  assert.deepEqual(drive.step(0.1, BESIDE), { seat: null, chair: 0, hold: null, clip: null });
});
