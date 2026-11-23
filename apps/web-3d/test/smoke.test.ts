import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { identityCalls, serveIdentityFixture } from './identity-fixture.ts';

type StageState = Record<string, string>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const PAGE_TIMEOUT = 90000;
const PORT_TIMEOUT = 30000;
const POLL_INTERVAL = 250;
const CALL_TIMEOUT = 10000;
const LFS_HEAD = 'version https://git-lfs';
const PROBLEM_MESSAGE = /Uncaught|Error|INVALID_|THREE\.(?!WebGLRenderer: Context (Lost|Restored))/;
const STAGE_STATE = "JSON.stringify({ ...(document.querySelector('#stage')?.dataset ?? {}) })";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter((path): path is string => Boolean(path));
const CHROME_FLAGS = [
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-gpu-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-logging=stderr',
  '--v=0',
  '--window-size=1280,720',
  '--remote-debugging-port=0',
];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
};

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
let server: Server | undefined;
let origin = '';
let workerRevision = 1;
let apiRequests = 0;
let disconnectHome = false;

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

function fileFor(pathname: string): string | null {
  const clean = pathname.split('?')[0] ?? '/';
  const direct = resolve(join(OUT, clean));
  if (!direct.startsWith(OUT)) return null;
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const page = clean.endsWith('/') ? join(direct, 'index.html') : `${direct}.html`;
  return existsSync(page) ? page : null;
}

before(async () => {
  server = createServer((request, response) => {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/api/pwa-test') {
      response.writeHead(200, { 'Cache-Control': 'no-store' }).end(String(++apiRequests));
      return;
    }
    if (pathname === '/' && disconnectHome) {
      response.destroy();
      return;
    }
    if (request.url?.startsWith('/api/identity/v1/')) {
      void serveIdentityFixture(request, response);
      return;
    }
    const file = fileFor(decodeURIComponent(request.url ?? '/'));
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    if (pathname === '/sw.js') {
      response
        .writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' })
        .end(`${readFileSync(file, 'utf8')}\n/* test revision ${workerRevision} */`);
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((ready) => server?.listen(0, '127.0.0.1', ready));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('static server has no port');
  origin = `http://127.0.0.1:${address.port}`;
});

after(() => server?.close());

class Devtools {
  private next = 1;
  private pending = new Map<number, { ok: (value: unknown) => void; no: (error: Error) => void }>();
  private readonly socket: WebSocket;
  private closed = false;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (event) => {
      const data = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      if (typeof data.id !== 'number') return;
      const waiter = this.pending.get(data.id);
      if (!waiter) return;
      this.pending.delete(data.id);
      if (data.error) waiter.no(new Error(data.error.message));
      else waiter.ok(data.result);
    });
    socket.addEventListener('close', () => this.fail(new Error('DevTools socket closed')));
    socket.addEventListener('error', () => this.fail(new Error('DevTools socket failed')));
  }

  private fail(error: Error) {
    this.closed = true;
    for (const waiter of this.pending.values()) waiter.no(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error('DevTools socket closed'));
    const id = this.next++;
    return new Promise((ok, no) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        no(new Error(`${method} timed out`));
      }, CALL_TIMEOUT);
      this.pending.set(id, {
        ok: (value) => {
          clearTimeout(timer);
          ok(value);
        },
        no: (error) => {
          clearTimeout(timer);
          no(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const reply = (await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })) as { result: { value: T } };
    return reply.result.value;
  }

  async waitFor(expression: string) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await this.evaluate<boolean>(`Boolean(${expression})`).catch(() => false)) return;
      await sleep(100);
    }
    assert.fail(`Trình duyệt chưa ở trạng thái: ${expression}`);
  }
}

async function devtoolsPort(profile: string): Promise<number> {
  const file = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + PORT_TIMEOUT;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const port = Number(readFileSync(file, 'utf8').split('\n')[0]);
      if (port > 0) return port;
    }
    await sleep(100);
  }
  throw new Error('Chrome did not open a DevTools port');
}

async function openPage(port: number): Promise<Devtools> {
  const deadline = Date.now() + PORT_TIMEOUT;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
    const targets = response
      ? ((await response.json()) as { type: string; webSocketDebuggerUrl: string }[])
      : [];
    const page = targets.find((target) => target.type === 'page');
    if (page) {
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise<void>((ok, no) => {
        socket.addEventListener('open', () => ok(), { once: true });
        socket.addEventListener('error', () => no(new Error('DevTools socket failed')), {
          once: true,
        });
      });
      return new Devtools(socket);
    }
    await sleep(100);
  }
  throw new Error('Chrome has no page target');
}

function removeProfile(profile: string) {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EBUSY' && code !== 'EPERM') throw error;
  }
}

function consoleErrorsOf(stderr: string) {
  const message = (line: string) => line.replace(/^.*CONSOLE[:(][^\]]*\]\s*/, '');
  return stderr
    .split('\n')
    .filter((line) => /CONSOLE/.test(line))
    .filter((line) => /:ERROR:CONSOLE/.test(line) || PROBLEM_MESSAGE.test(message(line)))
    .map(message);
}

async function renderPage(
  path: string,
  settled: (state: StageState) => boolean,
  exercise?: (browser: Devtools) => Promise<void>,
) {
  if (!chrome) throw new Error('no chrome');
  const profile = mkdtempSync(join(tmpdir(), 'web-3d-smoke-'));
  const child = spawn(chrome, [...CHROME_FLAGS, `--user-data-dir=${profile}`, 'about:blank'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  let state: StageState = {};
  try {
    const devtools = await openPage(await devtoolsPort(profile));
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Page.navigate', { url: `${origin}${path}` });
    const deadline = Date.now() + PAGE_TIMEOUT;
    while (Date.now() < deadline) {
      state = await devtools
        .evaluate<string>(STAGE_STATE)
        .then((json) => JSON.parse(json) as StageState)
        .catch(() => state);
      if (settled(state)) break;
      await sleep(POLL_INTERVAL);
    }
    await exercise?.(devtools);
    const dom = await devtools
      .evaluate<string>('document.documentElement.outerHTML')
      .catch(() => '');
    devtools.send('Browser.close').catch(() => undefined);
    const attribute = (name: string) => state[name];
    return { dom, consoleErrors: consoleErrorsOf(stderr), attribute, state };
  } finally {
    child.kill();
    await new Promise<void>((done) => {
      if (child.exitCode !== null || child.signalCode !== null) done();
      else child.once('close', () => done());
    });
    removeProfile(profile);
  }
}

function modelsArePointers(): boolean {
  const model = join(OUT, 'game-assets', 'exported', 'player.glb');
  if (!existsSync(model)) return true;
  const head = Buffer.alloc(LFS_HEAD.length);
  const handle = openSync(model, 'r');
  readSync(handle, head, 0, head.length, 0);
  closeSync(handle);
  return head.toString('utf8') === LFS_HEAD;
}

function browserReady(context: TestContext, needsModels = true): boolean {
  if (!existsSync(join(OUT, 'index.html'))) {
    context.skip('chưa có bản xuất tĩnh');
    return false;
  }
  if (needsModels && modelsArePointers()) {
    context.skip('mô hình chỉ là con trỏ LFS, chạy git lfs pull để thử trang');
    return false;
  }
  if (!chrome) {
    context.skip('không tìm thấy Chrome, đặt CHROME_PATH để chạy');
    return false;
  }
  return true;
}

async function pressKey(browser: Devtools, code: string, key: string, hold = 40) {
  const keyCode = key.toUpperCase().charCodeAt(0);
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await sleep(hold);
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

const SEAT_ROUTES = [
  [
    ['KeyS', 's'],
    ['KeyD', 'd'],
  ],
  [
    ['KeyW', 'w'],
    ['KeyA', 'a'],
  ],
  [
    ['KeyW', 'w'],
    ['KeyD', 'd'],
  ],
  [
    ['KeyS', 's'],
    ['KeyA', 'a'],
  ],
] as const;

async function pressKeysUntil(
  browser: Devtools,
  keys: readonly (readonly [string, string])[],
  condition: string,
) {
  for (const [code, key] of keys) {
    const keyCode = key.toUpperCase().charCodeAt(0);
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    });
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(100);
    if (await browser.evaluate<boolean>(`Boolean(${condition})`)) break;
  }
  for (const [code, key] of [...keys].reverse()) {
    const keyCode = key.toUpperCase().charCodeAt(0);
    await browser.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
    });
  }
}

async function walkToNearbySeat(browser: Devtools) {
  const nearbySeat = `document.querySelector('#stage')?.dataset.nearbySeat`;
  for (const route of SEAT_ROUTES) {
    if (await browser.evaluate<boolean>(`Boolean(${nearbySeat})`)) break;
    await pressKeysUntil(browser, route, `Boolean(${nearbySeat})`);
    await sleep(120);
    if (await browser.evaluate<boolean>(`Boolean(${nearbySeat})`)) break;
  }
  const seatState = await browser.evaluate<string>(
    `JSON.stringify({nearby: document.querySelector('#stage')?.dataset.nearbySeat, session: document.querySelector('#stage')?.dataset.sessionSeat})`,
  );
  assert.ok(
    await browser.evaluate<boolean>(`Boolean(${nearbySeat})`),
    `chưa tới gần máy: ${seatState}`,
  );
}

async function walkAwayFromSeat(browser: Devtools, seatId: string) {
  const nearbySeat = `document.querySelector('#stage')?.dataset.nearbySeat`;
  const leftSeat = `${nearbySeat} !== ${JSON.stringify(seatId)}`;
  for (const route of SEAT_ROUTES) {
    if (await browser.evaluate<boolean>(`Boolean(${leftSeat})`)) break;
    await pressKeysUntil(browser, route, leftSeat);
    await sleep(120);
    if (await browser.evaluate<boolean>(`Boolean(${leftSeat})`)) break;
  }
  const currentSeat = await browser.evaluate<string>(nearbySeat);
  assert.notEqual(currentSeat, seatId, `vẫn còn trong tầm của ${seatId}`);
}

test('bản xuất tĩnh có sẵn trước khi thử', () => {
  assert.ok(
    existsSync(join(OUT, 'index.html')),
    'thiếu out/index.html: chạy pnpm --filter @netverse/web-3d build trước',
  );
});

test('trang thử có canvas và nhân vật có mặt, không lỗi console', async (context) => {
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
  );
  assert.match(page.dom, /<canvas[^>]*id="gl"/);
  assert.equal(page.attribute('ready'), 'true', JSON.stringify(page.state));
  assert.equal(page.attribute('face'), 'true');
  assert.equal(page.attribute('recipe'), 'tim-neon');
  assert.ok(Number(page.attribute('frames')) >= 1, `frames=${page.attribute('frames')}`);
  assert.deepEqual(page.consoleErrors, []);
});

test('mất ngữ cảnh WebGL rồi khôi phục thì cảnh dựng lại, không trắng màn hình', async (context) => {
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/?probe=context-loss',
    (state) =>
      state.restored === 'true' &&
      state.ready === 'true' &&
      Number(state.rebuilds) >= 2 &&
      Number(state.frames) >= 1,
  );
  assert.equal(page.attribute('restored'), 'true', JSON.stringify(page.state));
  assert.equal(page.attribute('ready'), 'true');
  assert.ok(Number(page.attribute('rebuilds')) >= 2, `rebuilds=${page.attribute('rebuilds')}`);
  assert.ok(Number(page.attribute('frames')) >= 1, `frames=${page.attribute('frames')}`);
  assert.deepEqual(page.consoleErrors, []);
});

test('đăng ký, xác minh, vào tiệm, tải lại trang và đặt lại mật khẩu', async (context) => {
  if (!browserReady(context, false)) return;
  const realModels = !modelsArePointers();
  const page = await renderPage(
    '/',
    (state) =>
      realModels ? state.ready === 'true' && Number(state.frames) > 0 : Boolean(state.recipe),
    async (browser) => {
      const waitFor = (expression: string) => browser.waitFor(expression);
      const dialog = `document.querySelector('dialog[open]')`;
      const title = `${dialog}?.querySelector('h1')?.textContent`;
      const accountButton = `document.querySelector('[aria-label="Tài khoản"] button:not([disabled])')`;

      async function click(query: string) {
        await waitFor(query);
        await browser.evaluate(`(${query}).click()`);
      }
      async function submit(fields: Record<string, string>) {
        for (const [name, value] of Object.entries(fields)) {
          await browser.evaluate(
            `(${dialog}.querySelector('[name="${name}"]')).value = ${JSON.stringify(value)}`,
          );
        }
        await click(`${dialog}?.querySelector('button[type="submit"]:not([disabled])')`);
      }
      async function heading(label: string) {
        await waitFor(`${title} === ${JSON.stringify(label)}`);
      }
      const email = 'player@example.test';

      await click(accountButton);
      await heading('Đăng nhập');
      await click(`${dialog}?.querySelector('form + div button:first-child')`);
      await heading('Tạo tài khoản');
      await submit({ email, displayName: 'Người chơi thử', password: 'test-password-1' });
      await heading('Xác minh email');
      await click(`${dialog}?.querySelector('form + div button:last-child')`);
      await waitFor(`${dialog}?.querySelector('[role="status"]')`);
      await submit({ code: '000000' });
      await waitFor(
        `${dialog}?.querySelector('[role="alert"]')?.textContent?.includes('Mã không đúng')`,
      );
      await submit({ code: '091234' });
      await heading('Đăng nhập');
      assert.equal(
        await browser.evaluate(`${dialog}.querySelector('[name="email"]').value`),
        email,
      );
      await submit({ password: 'test-password-1' });
      await waitFor(`${accountButton}?.textContent === 'Đăng xuất' && !${dialog}`);
      await waitFor(
        `sessionStorage.getItem('netverse.identity.refresh') === 'browser-test-refresh-2'`,
      );

      await browser.send('Page.reload');
      await waitFor(
        `${accountButton}?.textContent === 'Đăng xuất' && sessionStorage.getItem('netverse.identity.refresh') === 'browser-test-refresh-3'`,
      );
      await click(accountButton);
      await heading('Đăng nhập');
      await waitFor(`sessionStorage.getItem('netverse.identity.refresh') === null`);
      await browser.send('Page.reload');
      await waitFor(`${accountButton}?.textContent === 'Đăng nhập' && !${dialog}`);
      await click(accountButton);
      await heading('Đăng nhập');
      await click(`${dialog}?.querySelector('form + div button:last-child')`);
      await heading('Quên mật khẩu?');
      await submit({ email });
      await heading('Đặt lại mật khẩu');
      await submit({ code: '004322', password: 'test-password-2' });
      await heading('Đăng nhập');
      await submit({ password: 'test-password-2' });
      await waitFor(`${accountButton}?.textContent === 'Đăng xuất' && !${dialog}`);
      if (realModels) await waitFor(`document.querySelector('#stage')?.dataset.ready === 'true'`);
      assert.equal(await browser.evaluate('window.location.pathname'), '/');
    },
  );
  assert.match(page.dom, /<canvas[^>]*id="gl"/);
  assert.deepEqual(identityCalls, [
    'auth/register',
    'auth/resend-verification',
    'auth/verify-email',
    'auth/verify-email',
    'auth/login',
    'me',
    'auth/refresh',
    'auth/refresh',
    'me',
    'auth/logout',
    'auth/password/forgot',
    'auth/password/reset',
    'auth/login',
    'me',
  ]);
});

test('không mở hộp thuê khi room session chưa khả dụng', async (context) => {
  if (process.env.NEXT_PUBLIC_ROOM === 'fake') {
    context.skip('cần bản build production không có room giả');
    return;
  }
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
    async (browser) => {
      await browser.waitFor(`document.querySelector('#stage')?.dataset.roomAvailable === 'false'`);
      await walkToNearbySeat(browser);
      await pressKey(browser, 'KeyE', 'e');
      await sleep(500);
      assert.equal(
        await browser.evaluate<boolean>(
          `Boolean(document.querySelector('[data-rental-confirmation]'))`,
        ),
        false,
        'không có room session thì không được mở xác nhận thuê',
      );
    },
  );
  assert.deepEqual(page.consoleErrors, []);
});

test('thuê miễn phí cần xác nhận, đồng hồ chạy và kết thúc trả máy', async (context) => {
  if (process.env.NEXT_PUBLIC_ROOM !== 'fake') {
    context.skip('cần bản build development với room giả');
    return;
  }
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
    async (browser) => {
      await browser.waitFor(`document.querySelector('#stage')?.dataset.roomAvailable === 'true'`);
      await walkToNearbySeat(browser);
      const capture = async (name: string) => {
        const { data } = (await browser.send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        })) as { data: string };
        const directory = join(ROOT, '..', '..', '.flow', 'handoff', 'session-overlay');
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, `${name}.png`), Buffer.from(data, 'base64'));
      };
      const dialog = `document.querySelector('[data-rental-confirmation][role="dialog"][aria-modal="true"]')`;
      await pressKey(browser, 'KeyE', 'e');
      await sleep(500);
      assert.ok(
        await browser.evaluate<boolean>(`Boolean(${dialog})`),
        'nhấn E phải hỏi xác nhận thuê miễn phí trước khi vào trạng thái ngồi',
      );
      const dialogText = await browser.evaluate<string>(`${dialog}.textContent`);
      assert.match(dialogText, /miễn phí/i);
      await capture('01-rental-confirmation');
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Hủy'))?.click()`,
      );
      await browser.waitFor(`!${dialog}`);
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(document.querySelector('[data-seated="true"]'))`),
        false,
      );
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      const requestedSeat = await browser.evaluate<string>(
        `document.querySelector('#stage')?.dataset.nearbySeat ?? ''`,
      );
      assert.notEqual(requestedSeat, '');
      await walkAwayFromSeat(browser, requestedSeat);
      await browser.waitFor(`!${dialog}`);
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(document.querySelector('[data-session-timer]'))`),
        false,
      );
      await walkToNearbySeat(browser);
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Thuê miễn phí'))?.click()`,
      );
      await browser.waitFor(`document.querySelector('[data-seated="true"]')`);
      await browser.waitFor(`document.querySelector('[data-session-timer]')`);
      await sleep(2200);
      const elapsed = await browser.evaluate<string>(
        `document.querySelector('[data-session-timer]')?.textContent ?? ''`,
      );
      const elapsedSeconds = elapsed
        .split(':')
        .map(Number)
        .reduce((total, part) => total * 60 + part, 0);
      assert.ok(elapsedSeconds >= 2, `đồng hồ phiên phải đạt ít nhất 00:02: ${elapsed}`);
      await capture('02-active-session');
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await browser.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 1,
      });
      await sleep(300);
      const mobileLayout = await browser.evaluate<{
        width: number;
        height: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
        buttonHeight: number;
        pwaPresent: boolean;
        pwaOverlapArea: number;
      }>(`(() => {
        const panel = document.querySelector('[data-session-timer]')?.closest('[data-seated="true"]');
        const button = panel?.querySelector('button');
        const bounds = panel?.getBoundingClientRect();
        const pwa = [...document.querySelectorAll('button')].find(candidate =>
          /^(Cài ứng dụng|Cập nhật ứng dụng)$/.test(candidate.textContent?.trim() ?? '')
        );
        const pwaBounds = pwa?.getBoundingClientRect();
        const overlapWidth = pwaBounds && bounds
          ? Math.max(0, Math.min(bounds.right, pwaBounds.right) - Math.max(bounds.left, pwaBounds.left))
          : 0;
        const overlapHeight = pwaBounds && bounds
          ? Math.max(0, Math.min(bounds.bottom, pwaBounds.bottom) - Math.max(bounds.top, pwaBounds.top))
          : 0;
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          left: bounds?.left ?? -1,
          right: bounds?.right ?? -1,
          top: bounds?.top ?? -1,
          bottom: bounds?.bottom ?? -1,
          buttonHeight: button?.getBoundingClientRect().height ?? 0,
          pwaPresent: Boolean(pwa),
          pwaOverlapArea: overlapWidth * overlapHeight,
        };
      })()`);
      assert.equal(mobileLayout.width, 390);
      assert.ok(mobileLayout.left >= 0 && mobileLayout.right <= mobileLayout.width);
      assert.ok(mobileLayout.top >= 0 && mobileLayout.bottom <= mobileLayout.height);
      assert.ok(mobileLayout.buttonHeight >= 44);
      assert.equal(mobileLayout.pwaPresent, true);
      assert.equal(mobileLayout.pwaOverlapArea, 0);
      await capture('04-mobile-active-session');
      await browser.send('Emulation.clearDeviceMetricsOverride');
      await browser.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Kết thúc phiên'))?.click()`,
      );
      await browser.waitFor(`!document.querySelector('[data-session-timer]')`);
      await browser.waitFor(`document.querySelector('[data-seat][data-seated="false"]')`);
      await sleep(2200);
      await capture('03-session-ended');
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Hủy'))?.click()`,
      );
    },
  );
  assert.deepEqual(page.consoleErrors, []);
});

test('bản PWA cài được, cập nhật theo yêu cầu và báo mất kết nối', async (context) => {
  if (!browserReady(context, false)) return;
  await renderPage(
    '/',
    (state) => Boolean(state.recipe),
    async (browser) => {
      await browser.waitFor('navigator.serviceWorker.controller?.state === "activated"');
      const installability = (await browser.send('Page.getInstallabilityErrors')) as {
        installabilityErrors: unknown[];
      };
      assert.deepEqual(installability.installabilityErrors, []);

      const manifestUrl = await browser.evaluate<string>(
        `document.querySelector('link[rel="manifest"]').href`,
      );
      const manifestResponse = await fetch(manifestUrl);
      assert.equal(manifestResponse.headers.get('Content-Type'), 'application/json');
      const manifest = await manifestResponse.json();
      assert.equal(manifest.start_url, '/');
      assert.equal(manifest.display, 'standalone');
      assert.ok(
        await browser.evaluate(
          `document.querySelector('link[rel="apple-touch-icon"]').href.endsWith('/apple-touch-icon.png')`,
        ),
      );

      const probe = `fetch('/api/pwa-test').then(response => response.text())`;
      assert.equal(await browser.evaluate(probe), '1');
      assert.equal(await browser.evaluate(probe), '2');
      assert.deepEqual(await browser.evaluate('caches.keys()'), []);

      await browser.evaluate('window.__pwaTestPage = true');
      workerRevision += 1;
      await browser.evaluate(
        'navigator.serviceWorker.ready.then(registration => registration.update())',
      );
      const updateButton = `[...document.querySelectorAll('button')].find(button => button.textContent === 'Cập nhật ứng dụng')`;
      await browser.waitFor(updateButton);
      assert.equal(await browser.evaluate('window.__pwaTestPage'), true);
      assert.equal(
        await browser.evaluate(
          'navigator.serviceWorker.ready.then(registration => registration.waiting?.state)',
        ),
        'installed',
      );
      await browser.evaluate(`${updateButton}.click()`);
      await browser.waitFor(
        `!window.__pwaTestPage && navigator.serviceWorker.controller?.state === 'activated' && document.querySelector('#stage')`,
      );
      await browser.waitFor(`!(${updateButton})`);

      disconnectHome = true;
      try {
        await browser.send('Page.reload');
        await browser.waitFor(`document.querySelector('h1')?.textContent === 'Mất kết nối'`);
      } finally {
        disconnectHome = false;
      }
      await browser.evaluate(`document.querySelector('main a').click()`);
      await browser.waitFor(`document.querySelector('#stage')`);
    },
  );
});
