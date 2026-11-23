import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT_TIMEOUT = 30000;
const CALL_TIMEOUT = 10000;
const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
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
  '--remote-debugging-port=0',
];
const PROBLEM_MESSAGE = /Uncaught|Error|INVALID_|THREE\.(?!WebGLRenderer: Context (Lost|Restored))/;

export function findChrome({
  env = process.env,
  candidates = CHROME_CANDIDATES,
  exists = existsSync,
} = {}) {
  if (env.CHROME_PATH && exists(env.CHROME_PATH)) return env.CHROME_PATH;
  return candidates.find((path) => exists(path)) ?? null;
}

export function consoleErrorsOf(stderr) {
  const message = (line) => line.replace(/^.*CONSOLE[:(][^\]]*\]\s*/, '');
  return stderr
    .split('\n')
    .filter((line) => /CONSOLE/.test(line))
    .filter((line) => /:ERROR:CONSOLE/.test(line) || PROBLEM_MESSAGE.test(message(line)))
    .map(message);
}

export function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function removeProfile(profile) {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    const code = error.code;
    if (code !== 'EBUSY' && code !== 'EPERM') throw error;
  }
}

async function devtoolsPort(profile, child) {
  const file = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + PORT_TIMEOUT;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Chrome exited before opening a DevTools port');
    }
    if (existsSync(file)) {
      const port = Number(readFileSync(file, 'utf8').split('\n')[0]);
      if (port > 0) return port;
    }
    await sleep(100);
  }
  throw new Error('Chrome did not open a DevTools port');
}

function createDevtools(socket) {
  let next = 1;
  const pending = new Map();
  let closed = false;
  const failPendingCommands = (error) => {
    closed = true;
    for (const waiter of pending.values()) waiter.no(error);
    pending.clear();
  };
  const sendCommand = (method, params = {}) => {
    if (closed) return Promise.reject(new Error('DevTools socket closed'));
    const id = next++;
    return new Promise((ok, no) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        no(new Error(`${method} timed out`));
      }, CALL_TIMEOUT);
      pending.set(id, {
        ok: (value) => {
          clearTimeout(timer);
          ok(value);
        },
        no: (error) => {
          clearTimeout(timer);
          no(error);
        },
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
  const evaluate = async (expression) => {
    const reply = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return reply.result.value;
  };

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(String(event.data));
    if (typeof data.id !== 'number') return;
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.error) waiter.no(new Error(data.error.message));
    else waiter.ok(data.result);
  });
  socket.addEventListener('close', () => failPendingCommands(new Error('DevTools socket closed')));
  socket.addEventListener('error', () => failPendingCommands(new Error('DevTools socket failed')));

  return { send: sendCommand, evaluate, socket };
}

async function openPage(port) {
  const deadline = Date.now() + PORT_TIMEOUT;
  while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
    const targets = response ? await response.json() : [];
    const page = targets.find((target) => target.type === 'page');
    if (page) {
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((ok, no) => {
        socket.addEventListener('open', () => ok(), { once: true });
        socket.addEventListener('error', () => no(new Error('DevTools socket failed')), {
          once: true,
        });
      });
      return createDevtools(socket);
    }
    await sleep(100);
  }
  throw new Error('Chrome has no page target');
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((done) => child.once('close', done));
}

export async function launchChrome({ width, height }) {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new RangeError('Chrome width and height must be positive integers');
  }
  const chrome = findChrome();
  if (!chrome) throw new Error('no chrome');
  const profile = mkdtempSync(join(tmpdir(), 'netverse-cdp-'));
  const child = spawn(
    chrome,
    [
      ...CHROME_FLAGS,
      `--window-size=${width},${height}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  let devtools;
  child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
  try {
    const spawnError = new Promise((_, reject) => child.once('error', reject));
    const port = await Promise.race([devtoolsPort(profile, child), spawnError]);
    devtools = await openPage(port);
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });
  } catch (error) {
    devtools?.socket.close();
    child.kill();
    await waitForExit(child);
    removeProfile(profile);
    throw error;
  }

  let closed = false;
  return {
    send: (method, params) => devtools.send(method, params),
    openPage: (url) => devtools.send('Page.navigate', { url }),
    evaluate: (expression) => devtools.evaluate(expression),
    waitFor: async (expression, timeout = 15000) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await devtools.evaluate(`Boolean(${expression})`).catch(() => false)) return;
        await sleep(100);
      }
      throw new Error(`Browser did not reach state: ${expression}`);
    },
    screenshot: async (path) => {
      const reply = await devtools.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(path, Buffer.from(reply.data, 'base64'));
    },
    close: async () => {
      if (closed) return;
      closed = true;
      child.kill();
      devtools.socket.close();
      await waitForExit(child);
      removeProfile(profile);
    },
    get stderr() {
      return stderr;
    },
  };
}
