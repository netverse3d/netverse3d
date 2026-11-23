import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { findChrome, launchChrome, sleep } from './cdp.mjs';

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

test(
  'screenshot giữ đúng viewport dù nội dung trang dài hơn khung hình',
  { skip: !findChrome() },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'netverse-cdp-test-'));
    const path = join(directory, 'page.png');
    let browser;
    try {
      browser = await launchChrome({ width: 1400, height: 850 });
      const html = '<!doctype html><style>body{margin:0}main{height:3000px}</style><main></main>';
      await browser.openPage(`data:text/html,${encodeURIComponent(html)}`);
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const ready = await browser
          .evaluate(
            "document.readyState === 'complete' && document.documentElement.scrollHeight >= 3000",
          )
          .catch(() => false);
        if (ready) break;
        await sleep(100);
      }
      await browser.screenshot(path);
      const image = readFileSync(path);
      assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [1400, 850]);
    } finally {
      await browser?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
