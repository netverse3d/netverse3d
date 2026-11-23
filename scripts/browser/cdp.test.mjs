import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findChrome } from './cdp.mjs';

test('findChrome ưu tiên CHROME_PATH khi được cấu hình', () => {
  assert.equal(
    findChrome({
      env: { CHROME_PATH: '/custom/chrome' },
      candidates: [],
      exists: (path) => path === '/custom/chrome',
    }),
    '/custom/chrome',
  );
});

test('findChrome trả null khi không ứng viên nào tồn tại', () => {
  assert.equal(findChrome({ env: {}, candidates: ['/missing/chrome'], exists: () => false }), null);
});
