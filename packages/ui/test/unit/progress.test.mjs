import assert from 'node:assert/strict';
import { test } from 'node:test';
import { progressValue } from '../../src/progress.mjs';

test('thanh tiến độ không nhận giá trị ngoài 0–100', () => {
  for (const value of [-1, 100.5, 250, Number.NaN, Number.POSITIVE_INFINITY])
    assert.equal(progressValue(value), null, String(value));
  assert.equal(progressValue(0), 0);
  assert.equal(progressValue(42.5), 42.5);
  assert.equal(progressValue(100), 100);
});

test('thanh tiến độ không có giá trị là trạng thái chờ không xác định', () => {
  assert.equal(progressValue(undefined), null);
  assert.equal(progressValue(null), null);
});
