import assert from 'node:assert/strict';
import { test } from 'node:test';

test('định dạng thời lượng còn lại thành đồng hồ dùng chung cho các lớp phiên', async () => {
  const formatterModule = await import('./session-time.ts').catch(() => null);
  const format = formatterModule?.formatSessionDuration;
  assert.equal(typeof format, 'function');
  if (!format) return;
  assert.equal(format(62), '01:02');
  assert.equal(format(3_600), '01:00:00');
});
