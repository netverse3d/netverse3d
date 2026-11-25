import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buttonInteraction, closesOnCancel } from '../../src/interaction.mjs';

test('nút đang chờ không nhận lệnh và báo bận cho trình đọc màn hình', () => {
  assert.deepEqual(buttonInteraction('pending', false), {
    disabled: true,
    busy: true,
    spinner: true,
  });
});

test('nút thường nhận lệnh, nút tắt thì không', () => {
  assert.deepEqual(buttonInteraction('idle', false), {
    disabled: false,
    busy: false,
    spinner: false,
  });
  assert.equal(buttonInteraction('disabled', false).disabled, true);
  assert.equal(buttonInteraction('idle', true).disabled, true);
});

test('hộp thoại đang xử lý không đóng bằng Escape', () => {
  assert.equal(closesOnCancel(true), false);
  assert.equal(closesOnCancel(false), true);
});
