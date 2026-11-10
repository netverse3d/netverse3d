import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { after, before, test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

interface ChromeRun {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const CHROME_TIMEOUT = 120000;
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter((path): path is string => Boolean(path));
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

function runChrome(args: string[]): Promise<ChromeRun> {
  return new Promise((settle) => {
    if (!chrome) throw new Error('no chrome');
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => child.kill(), CHROME_TIMEOUT);
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      settle({ status, signal, stdout, stderr });
    });
    child.on('error', (error) => settle({ status: null, signal: null, stdout, stderr, error }));
  });
}

async function renderPage(path: string) {
  const profile = mkdtempSync(join(tmpdir(), 'web-3d-smoke-'));
  const result = await runChrome([
    '--headless=new',
    `--user-data-dir=${profile}`,
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
    '--virtual-time-budget=90000',
    '--dump-dom',
    `${origin}${path}`,
  ]);
  rmSync(profile, { recursive: true, force: true });
  if (result.status !== 0 || !result.stdout) {
    throw new Error(
      `Chrome exited with status ${result.status} signal ${result.signal} ${result.error?.message ?? ''}\n${result.stderr.slice(-1500)}`,
    );
  }
  const consoleErrors = result.stderr
    .split('\n')
    .filter((line) => /:ERROR:CONSOLE/.test(line))
    .map((line) => line.replace(/^.*CONSOLE\(\d+\)\]\s*/, ''));
  const attribute = (name: string) =>
    result.stdout.match(new RegExp(`data-${name}="([^"]*)"`))?.[1];
  return { dom: result.stdout, consoleErrors, attribute };
}

function browserReady(context: TestContext): boolean {
  if (!existsSync(join(OUT, 'index.html'))) {
    context.skip('chưa có bản xuất tĩnh');
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
  const page = await renderPage('/');
  assert.match(page.dom, /<canvas[^>]*id="gl"/);
  assert.equal(page.attribute('ready'), 'true', page.dom.slice(0, 400));
  assert.equal(page.attribute('face'), 'true');
  assert.equal(page.attribute('recipe'), 'tim-neon');
  assert.deepEqual(page.consoleErrors, []);
});

test('mất ngữ cảnh WebGL rồi khôi phục thì cảnh dựng lại, không trắng màn hình', async (context) => {
  if (!browserReady(context)) return;
  const page = await renderPage('/?probe=context-loss');
  assert.equal(page.attribute('restored'), 'true');
  assert.equal(page.attribute('ready'), 'true');
  assert.ok(Number(page.attribute('rebuilds')) >= 2, `rebuilds=${page.attribute('rebuilds')}`);
  assert.deepEqual(page.consoleErrors, []);
});
