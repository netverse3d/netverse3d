import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageSteps } from '../../src/pagination.mjs';

test('phân trang tắt nút trước ở trang đầu và nút sau ở trang cuối', () => {
  assert.deepEqual(pageSteps(1, 3), { previous: null, next: 2 });
  assert.deepEqual(pageSteps(2, 3), { previous: 1, next: 3 });
  assert.deepEqual(pageSteps(3, 3), { previous: 2, next: null });
  assert.deepEqual(pageSteps(1, 1), { previous: null, next: null });
});

test('trang ngoài khoảng vẫn chỉ dẫn về trang có thật', () => {
  assert.deepEqual(pageSteps(5, 3), { previous: 3, next: null });
  assert.deepEqual(pageSteps(0, 3), { previous: null, next: 1 });
  assert.deepEqual(pageSteps(1, 0), { previous: null, next: null });
});
