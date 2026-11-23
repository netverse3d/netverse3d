import assert from 'node:assert/strict';
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { consoleErrorsOf, findChrome, launchChrome, sleep } from '../../../scripts/browser/cdp.mjs';
import { identityCalls, serveIdentityFixture } from './identity-fixture.ts';

type StageState = Record<string, string>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const PAGE_TIMEOUT = 90000;
const POLL_INTERVAL = 250;
const LFS_HEAD = 'version https://git-lfs';
const STAGE_STATE = "JSON.stringify({ ...(document.querySelector('#stage')?.dataset ?? {}) })";
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

const chrome = findChrome();
let server: ReturnType<typeof createServer> | undefined;
let origin = '';
let workerRevision = 1;
let apiRequests = 0;
let disconnectHome = false;

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

type BrowserSession = Awaited<ReturnType<typeof launchChrome>> & {
  evaluate<T = unknown>(expression: string): Promise<T>;
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  waitFor(expression: string, timeout?: number): Promise<void>;
};

async function renderPage(
  path: string,
  settled: (state: StageState) => boolean,
  exercise?: (browser: BrowserSession) => Promise<void>,
) {
  if (!chrome) throw new Error('no chrome');
  const browser = (await launchChrome({ width: 1280, height: 720 })) as BrowserSession;
  let state: StageState = {};
  try {
    await browser.openPage(`${origin}${path}`);
    const deadline = Date.now() + PAGE_TIMEOUT;
    while (Date.now() < deadline) {
      state = await browser
        .evaluate<string>(STAGE_STATE)
        .then((json) => JSON.parse(json) as StageState)
        .catch(() => state);
      if (settled(state)) break;
      await sleep(POLL_INTERVAL);
    }
    await exercise?.(browser);
    const dom = await browser
      .evaluate<string>('document.documentElement.outerHTML')
      .catch(() => '');
    const attribute = (name: string) => state[name];
    return { dom, consoleErrors: consoleErrorsOf(browser.stderr), attribute, state };
  } finally {
    await browser.close();
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

async function pressKey(browser: BrowserSession, code: string, key: string, hold = 40) {
  const keyCode = key === 'Enter' ? 13 : key === 'Escape' ? 27 : key.toUpperCase().charCodeAt(0);
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
  browser: BrowserSession,
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

async function walkToNearbySeat(browser: BrowserSession) {
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

async function walkAwayFromSeat(browser: BrowserSession, seatId: string) {
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
  assert.equal(page.attribute('lighting'), 'shop-neon');
  assert.ok(Number(page.attribute('frames')) >= 1, `frames=${page.attribute('frames')}`);
  assert.deepEqual(page.consoleErrors, []);
});

test('recipe không tồn tại quay về tiệm mặc định và preset shop-neon', async (context) => {
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/?shop=not-a-recipe',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
  );
  assert.equal(page.attribute('recipe'), 'tim-neon');
  assert.equal(page.attribute('lighting'), 'shop-neon');
  assert.deepEqual(page.consoleErrors, []);
});

test('tiệm biển sâu chọn preset ánh sáng shop-dim', async (context) => {
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/?shop=bien-sau',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
  );
  assert.equal(page.attribute('ready'), 'true', JSON.stringify(page.state));
  assert.equal(page.attribute('recipe'), 'bien-sau');
  assert.equal(page.attribute('lighting'), 'shop-dim');
  assert.deepEqual(page.consoleErrors, []);
});

test('đổi tiệm cập nhật preset ánh sáng theo cả hai chiều', async (context) => {
  if (!browserReady(context)) return;
  const browser = await launchChrome({ width: 1280, height: 720 });
  try {
    await browser.openPage(origin);
    const waitForStage = async (settled: (state: StageState) => boolean) => {
      let state: StageState = {};
      const deadline = Date.now() + PAGE_TIMEOUT;
      while (Date.now() < deadline) {
        state = await browser
          .evaluate(STAGE_STATE)
          .then((json) => JSON.parse(json as string) as StageState)
          .catch(() => state);
        if (settled(state)) return state;
        await sleep(POLL_INTERVAL);
      }
      return state;
    };
    const initial = await waitForStage(
      (state) => state.ready === 'true' && Number(state.frames) >= 1,
    );
    assert.equal(initial.lighting, 'shop-neon');
    const selected = await browser.evaluate(`(() => {
      const select = [...document.querySelectorAll('select')].find((item) =>
        [...item.options].some((option) => option.value === 'bien-sau'),
      );
      if (!select) return null;
      select.value = 'bien-sau';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    })()`);
    assert.equal(selected, 'bien-sau');
    const dim = await waitForStage(
      (state) => state.recipe === 'bien-sau' && state.lighting === 'shop-dim',
    );
    assert.equal(dim.ready, 'true', JSON.stringify(dim));
    const restored = await browser.evaluate(`(() => {
      const select = [...document.querySelectorAll('select')].find((item) =>
        [...item.options].some((option) => option.value === 'tim-neon'),
      );
      if (!select) return null;
      select.value = 'tim-neon';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value;
    })()`);
    assert.equal(restored, 'tim-neon');
    const neon = await waitForStage(
      (state) => state.recipe === 'tim-neon' && state.lighting === 'shop-neon',
    );
    assert.equal(neon.ready, 'true', JSON.stringify(neon));
    assert.deepEqual(consoleErrorsOf(browser.stderr), []);
  } finally {
    await browser.close();
  }
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
      await browser.evaluate(`(() => {
        [...document.querySelectorAll('button')]
          .find(button => button.textContent?.trim() === 'Hủy')?.focus();
      })()`);
      await pressKey(browser, 'Enter', 'Enter');
      await browser.waitFor(`!${dialog}`);
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(${dialog})`),
        false,
        'Enter khi nút Hủy đang được focus phải huỷ xác nhận',
      );
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(document.querySelector('[data-seated="true"]'))`),
        false,
      );
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      await pressKey(browser, 'Escape', 'Escape');
      await browser.waitFor(`!${dialog}`);
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
      await browser.evaluate(`(() => {
        window.__rentalSubmitCount = 0;
        document.querySelector('[data-rental-confirmation] button[type="submit"]')?.focus();
        document.querySelector('[data-rental-confirmation] form')?.addEventListener('submit', () => {
          window.__rentalSubmitCount += 1;
        });
      })()`);
      await pressKey(browser, 'Enter', 'Enter');
      await browser.waitFor(`!${dialog}`);
      assert.equal(
        await browser.evaluate<number>(`window.__rentalSubmitCount`),
        1,
        'Enter trên nút Thuê phải gửi đúng một lần qua form',
      );
      await browser.waitFor(`document.querySelector('[data-seated="true"]')`);
      await browser.waitFor(`document.querySelector('[data-session-timer]')`);
      assert.equal(
        await browser.evaluate<string>(`document.querySelector('#stage')?.dataset.seatReady ?? ''`),
        'false',
      );
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(document.querySelector('[data-seat-desktop]'))`),
        false,
      );
      await browser.waitFor(`document.querySelector('#stage')?.dataset.seatReady === 'true'`);
      await browser.waitFor(`document.querySelector('[data-seat-desktop]')`);
      const desktop = await browser.evaluate<{
        seat: string;
        label: string;
        timer: string;
        timerClass: string;
        timerLive: string;
        disabledTiles: number;
        allDisabled: boolean;
      }>(`(() => {
        const panel = document.querySelector('[data-seat-desktop]');
        const timer = panel?.querySelector('[data-session-timer]');
        const tiles = [...(panel?.querySelectorAll('button[aria-disabled="true"]') ?? [])];
        return {
          seat: panel?.getAttribute('data-seat') ?? '',
          label: panel?.getAttribute('aria-label') ?? '',
          timer: timer?.textContent?.trim() ?? '',
          timerClass: timer?.className ?? '',
          timerLive: timer?.getAttribute('aria-live') ?? '',
          disabledTiles: tiles.length,
          allDisabled: tiles.every(button => button.disabled),
        };
      })()`);
      assert.match(desktop.label, /Máy/);
      assert.match(desktop.seat, /^seat-/);
      assert.ok(Number(desktop.timer.split(':').at(-1)) >= 0);
      assert.match(desktop.timerClass, /timer/);
      assert.equal(desktop.timerLive, 'polite');
      assert.equal(desktop.disabledTiles, 3);
      assert.equal(desktop.allDisabled, true);
      await pressKey(browser, 'Escape', 'Escape');
      await browser.waitFor(`document.querySelector('[data-desktop-restore]')`);
      await browser.evaluate(`document.querySelector('[data-desktop-restore]')?.click()`);
      await browser.waitFor(`document.querySelector('[data-seat-desktop]')`);
      await sleep(2200);
      const remaining = await browser.evaluate<string>(
        `document.querySelector('[data-session-timer]')?.textContent ?? ''`,
      );
      const remainingSeconds = remaining
        .split(':')
        .map(Number)
        .reduce((total, part) => total * 60 + part, 0);
      const initialSeconds = desktop.timer
        .split(':')
        .map(Number)
        .reduce((total, part) => total * 60 + part, 0);
      assert.ok(
        remainingSeconds > 0 && remainingSeconds < initialSeconds,
        `đồng hồ phải đếm ngược: ${remaining}`,
      );
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
        buttonName: string;
        pwaPresent: boolean;
        pwaOverlapArea: number;
      }>(`(() => {
        const panel = document.querySelector('[data-seat-desktop]');
        const button = panel?.querySelector('[data-end-session]');
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
          buttonName: button?.textContent?.trim() ?? '',
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
      await pressKey(browser, 'Escape', 'Escape');
      await browser.waitFor(`document.querySelector('[data-desktop-restore]')`);
      const minimizedBounds = await browser.evaluate<{
        left: number;
        right: number;
        height: number;
      }>(
        `(() => {
          const bounds = document.querySelector('[data-desktop-restore]')?.getBoundingClientRect();
          return { left: bounds?.left ?? -1, right: bounds?.right ?? -1, height: bounds?.height ?? 0 };
        })()`,
      );
      assert.ok(minimizedBounds.left >= mobileLayout.width / 2);
      assert.ok(minimizedBounds.height >= 44);
      await browser.evaluate(`document.querySelector('[data-desktop-restore]')?.click()`);
      await browser.waitFor(`document.querySelector('[data-seat-desktop]')`);
      await browser.send('Emulation.clearDeviceMetricsOverride');
      await browser.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await browser.evaluate(`document.querySelector('[data-end-session]')?.click()`);
      await browser.waitFor(
        `document.querySelector('#stage')?.dataset.sessionNoticeReason === 'left'`,
      );
      await browser.waitFor(`document.querySelector('[data-session-notice]')`);
      const endedState = await browser.evaluate<{
        stage: Record<string, string>;
        timerVisible: boolean;
      }>(`({
        stage: { ...(document.querySelector('#stage')?.dataset ?? {}) },
        timerVisible: Boolean(document.querySelector('[data-session-timer]')),
      })`);
      assert.equal(endedState.stage.sessionNoticeReason, 'left', JSON.stringify(endedState));
      const endedNotice = await browser.evaluate<{
        text: string;
        top: number;
        height: number;
        width: number;
        display: string;
        visibility: string;
        opacity: string;
      }>(`(() => {
        const notice = document.querySelector('[data-session-notice]');
        const bounds = notice?.getBoundingClientRect();
        const style = notice ? getComputedStyle(notice) : null;
        return {
          text: notice?.textContent ?? '',
          top: bounds?.top ?? -1,
          height: bounds?.height ?? 0,
          width: bounds?.width ?? 0,
          display: style?.display ?? 'none',
          visibility: style?.visibility ?? 'hidden',
          opacity: style?.opacity ?? '0',
        };
      })()`);
      assert.match(endedNotice.text, /đã kết thúc/i);
      assert.ok(endedNotice.top >= 0 && endedNotice.top < 100);
      assert.ok(endedNotice.width > 0 && endedNotice.height > 0);
      assert.notEqual(endedNotice.display, 'none');
      assert.equal(endedNotice.visibility, 'visible');
      assert.ok(Number(endedNotice.opacity) > 0);
      assert.equal(endedState.stage.sessionSeat, '');
      assert.equal(endedState.timerVisible, false);
      await capture('03-session-ended-notice');
      await browser.waitFor(`!document.querySelector('[data-session-notice]')`, 4000);
      await capture('06-session-ended-actor-standing');
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Hủy'))?.click()`,
      );
    },
  );
  assert.deepEqual(page.consoleErrors, []);
});

test('hết giờ theo đồng hồ phòng thì máy trống, actor đứng dậy và báo kết thúc', async (context) => {
  if (process.env.NEXT_PUBLIC_ROOM !== 'fake') {
    context.skip('cần bản build room giả để thử hết phiên');
    return;
  }
  if (!browserReady(context)) return;
  const page = await renderPage(
    '/?session=20',
    (state) => state.ready === 'true' && Number(state.frames) >= 1,
    async (browser) => {
      await browser.waitFor(`document.querySelector('#stage')?.dataset.roomAvailable === 'true'`);
      await walkToNearbySeat(browser);
      const dialog = `document.querySelector('[data-rental-confirmation][role="dialog"][aria-modal="true"]')`;
      await pressKey(browser, 'KeyE', 'e');
      await browser.waitFor(`Boolean(${dialog})`);
      await browser.evaluate(
        `([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Thuê miễn phí'))?.click()`,
      );
      await browser.waitFor(`document.querySelector('#stage')?.dataset.sessionSeat`);
      await browser.waitFor(`document.querySelector('#stage')?.dataset.seatReady === 'true'`);
      await browser.waitFor(`document.querySelector('[data-session-timer]')`);
      assert.equal(
        await browser.evaluate<string>(
          `document.querySelector('#stage')?.dataset.sessionNoticeReason ?? ''`,
        ),
        '',
      );
      assert.match(
        await browser.evaluate<string>(
          `document.querySelector('[data-session-timer]')?.className ?? ''`,
        ),
        /timerWarning/,
      );
      await browser.waitFor(`document.querySelector('[data-session-notice]')`, 25000);
      const result = await browser.evaluate<{
        seat: string;
        notice: string;
        timerVisible: boolean;
        desktopVisible: boolean;
      }>(`(() => ({
        seat: document.querySelector('#stage')?.dataset.sessionSeat ?? '',
        notice: document.querySelector('[data-session-notice]')?.textContent?.trim() ?? '',
        timerVisible: Boolean(document.querySelector('[data-session-timer]')),
        desktopVisible: Boolean(document.querySelector('[data-seat-desktop]')),
      }))()`);
      assert.equal(result.seat, '');
      assert.match(result.notice, /hết giờ/i);
      assert.equal(result.timerVisible, false);
      assert.equal(result.desktopVisible, false);
      await sleep(1800);
      const { data } = (await browser.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })) as { data: string };
      const directory = join(ROOT, '..', '..', '.flow', 'handoff', 'session-overlay');
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, '05-session-expired.png'), Buffer.from(data, 'base64'));
      await sleep(1400);
      assert.equal(
        await browser.evaluate<boolean>(`Boolean(document.querySelector('[data-session-notice]'))`),
        false,
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
