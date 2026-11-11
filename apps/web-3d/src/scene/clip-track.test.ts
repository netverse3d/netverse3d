import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createClipTrack } from './clip-track.ts';

const CLIPS = ['idle', 'walk', 'sit_down', 'sit_idle', 'typing', 'stand_up'];
const ONCE = ['sit_down', 'stand_up'];

test('ban đầu chạy hành động đứng yên và không hành động nào cần chạy lại', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  assert.equal(track.current(), 'idle');
  assert.equal(track.takeRestart('idle'), false);
});

test('chọn một hành động chạy một lần thì nó được chạy từ đầu đúng một lần', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  track.select('sit_down');
  assert.equal(track.current(), 'sit_down');
  assert.equal(track.takeRestart('sit_down'), true);
  assert.equal(track.takeRestart('sit_down'), false);
});

test('yêu cầu cùng một hành động ở nhiều khung hình liên tiếp thì không chạy lại từ đầu', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  track.select('sit_down');
  track.takeRestart('sit_down');
  for (let frame = 0; frame < 60; frame += 1) track.select('sit_down');
  assert.equal(track.current(), 'sit_down');
  assert.equal(track.takeRestart('sit_down'), false);
});

test('ngồi lần hai: hành động ngồi xuống được chọn lại sau các hành động khác thì chạy lại từ đầu', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  for (const name of ['sit_down', 'sit_idle', 'typing', 'stand_up', 'walk']) {
    track.select(name);
    track.takeRestart(name);
  }
  track.select('sit_down');
  assert.equal(track.takeRestart('sit_down'), true);
});

test('hành động lặp như gõ phím không bao giờ bị ép chạy lại', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  track.select('typing');
  assert.equal(track.takeRestart('typing'), false);
  track.select('idle');
  track.select('typing');
  assert.equal(track.takeRestart('typing'), false);
});

test('tên hành động không có trong nhân vật thì bỏ qua, giữ hành động đang chạy', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  track.select('typing');
  track.select('khong-co');
  assert.equal(track.current(), 'typing');
});

test('hành động chạy một lần không tự chuyển sang hành động khác lúc chạy xong', () => {
  const track = createClipTrack(CLIPS, ONCE, 'idle');
  track.select('stand_up');
  track.takeRestart('stand_up');
  assert.equal(track.current(), 'stand_up');
});
