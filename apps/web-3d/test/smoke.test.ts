import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

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
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
};

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
let server: Server | undefined;
let origin = '';

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
    const file = fileFor(decodeURIComponent(request.url ?? '/'));
    if (!file) {
      response.writeHead(404).end();
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

async function renderPage(path: string, settled: (state: StageState) => boolean) {
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

function browserReady(context: TestContext): boolean {
  if (!existsSync(join(OUT, 'index.html'))) {
    context.skip('chưa có bản xuất tĩnh');
    return false;
  }
  if (modelsArePointers()) {
    context.skip('mô hình chỉ là con trỏ LFS, chạy git lfs pull để thử trang');
    return false;
  }
  if (!chrome) {
    context.skip('không tìm thấy Chrome, đặt CHROME_PATH để chạy');
    return false;
  }
  return true;
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
