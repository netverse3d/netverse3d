import {
  createReadStream,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from '../../../../scripts/browser/cdp.mjs';
import { buildLibrary, buildPage } from '../../tools/library-files.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
};
const FIXTURES = fileURLToPath(new URL('../browser/fixtures/', import.meta.url));
const KEYS = {
  Enter: { code: 13, text: '\r' },
  Escape: { code: 27 },
  ArrowUp: { code: 38 },
  ArrowDown: { code: 40 },
};

export async function serveLibrary() {
  return serveBuilt((folder) => buildLibrary(folder));
}

export async function serveFixture(name) {
  return serveBuilt(async (folder) => {
    await buildPage(folder, name, resolve(FIXTURES, `${name}.tsx`));
    writeFileSync(resolve(folder, 'index.html'), fixtureHtml(name));
  });
}

function fixtureHtml(name) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><link rel="stylesheet" href="./${name}.css" /><script type="module" src="./${name}.js"></script></head><body><div id="root"></div></body></html>`;
}

async function serveBuilt(prepare) {
  const folder = mkdtempSync(resolve(tmpdir(), 'netverse-library-'));
  await prepare(folder);
  const root = resolve(folder);
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => {
      server.close();
      rmSync(folder, { recursive: true, force: true });
    },
  };
}

export async function press(browser, key) {
  const { code, text } = KEYS[key];
  for (const type of ['keyDown', 'keyUp']) {
    await browser.send('Input.dispatchKeyEvent', {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: code,
      nativeVirtualKeyCode: code,
      ...(type === 'keyDown' && text ? { text } : {}),
    });
    await sleep(40);
  }
}
