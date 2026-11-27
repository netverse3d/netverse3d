import assert from 'node:assert/strict';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome, sleep } from '../../../../scripts/browser/cdp.mjs';
import { buildLibrary } from '../../tools/library-files.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
};
const KEY_CODES = { Enter: 13, Escape: 27 };
const KEY_TEXT = { Enter: '\r' };
const DRAWER = `document.querySelector('[role="dialog"].nv-drawer')`;
const TRIGGER = `document.querySelector('[data-drawer-trigger]')`;

const chrome = findChrome();
let folder;
let server;
let origin;

before(async () => {
  if (!chrome) return;
  folder = mkdtempSync(resolve(tmpdir(), 'netverse-library-'));
  await buildLibrary(folder);
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    const file = resolve(folder, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (!file.startsWith(resolve(folder)) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  if (folder) rmSync(folder, { recursive: true, force: true });
});

async function press(browser, key) {
  const code = KEY_CODES[key];
  for (const type of ['keyDown', 'keyUp']) {
    await browser.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      ...(type === 'keyDown' && KEY_TEXT[key] ? { text: KEY_TEXT[key] } : {}),
      windowsVirtualKeyCode: code,
      nativeVirtualKeyCode: code,
    });
    await sleep(40);
  }
}

test('ngăn kéo đóng bằng Escape và trả focus', async (context) => {
  if (!chrome) {
    context.skip('không có Chrome');
    return;
  }
  const browser = await launchChrome({ width: 1280, height: 800 });
  try {
    await browser.openPage(`${origin}/`);
    await browser.waitFor(TRIGGER);
    await browser.waitFor(`document.querySelectorAll('.nv-toast-stack li').length > 0`);
    while (await browser.evaluate(`document.querySelectorAll('.nv-toast-stack li').length > 0`)) {
      await browser.evaluate(
        `document.querySelector('.nv-toast-stack li button[aria-label]').click()`,
      );
      await sleep(150);
    }
    await browser.evaluate(`${TRIGGER}.focus()`);
    await press(browser, 'Enter');
    await browser.waitFor(DRAWER);
    await browser.waitFor(`${DRAWER}.getAnimations().length === 0`);
    assert.equal(await browser.evaluate(`${DRAWER}.contains(document.activeElement)`), true);
    await press(browser, 'Escape');
    await browser.waitFor(`!${DRAWER}`);
    await browser.waitFor(`document.activeElement === ${TRIGGER}`, 2000);
  } finally {
    await browser.close();
  }
});
