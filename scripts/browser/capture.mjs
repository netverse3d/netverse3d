import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { consoleErrorsOf, findChrome, launchChrome, sleep } from './cdp.mjs';

const READY_TIMEOUT = 8000;
const POLL_INTERVAL = 250;

function parseArguments(args) {
  const outputIndex = args.indexOf('--out');
  const outputDirectory = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const urls = outputIndex >= 0 ? args.slice(outputIndex + 2) : [];
  if (!outputDirectory || urls.length === 0 || urls.some((url) => url.startsWith('--'))) {
    throw new Error('usage: node scripts/browser/capture.mjs --out <directory> <url>...');
  }
  return { outputDirectory: resolve(outputDirectory), urls };
}

function filenameFor(input) {
  const url = new URL(input);
  const name = `${url.hostname}${url.pathname}${url.search}`
    .replace(/[^a-z\d]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${name || 'page'}.png`;
}

async function waitUntilReady(browser) {
  const deadline = Date.now() + READY_TIMEOUT;
  while (Date.now() < deadline) {
    const ready = await browser
      .evaluate("document.body?.dataset?.ready === 'true'")
      .catch(() => false);
    if (ready) return;
    await sleep(POLL_INTERVAL);
  }
}

async function main() {
  const { outputDirectory, urls } = parseArguments(process.argv.slice(2));
  if (!findChrome()) throw new Error('Chrome was not found; set CHROME_PATH to run');
  mkdirSync(outputDirectory, { recursive: true });
  const browser = await launchChrome({ width: 1400, height: 850 });
  let reportedStderrLength = 0;
  try {
    for (const input of urls) {
      const url = new URL(input).href;
      await browser.openPage(url);
      await waitUntilReady(browser);
      const path = join(outputDirectory, filenameFor(url));
      await browser.screenshot(path);
      process.stdout.write(`${url} -> ${path}\n`);
      const stderr = browser.stderr;
      for (const error of consoleErrorsOf(stderr.slice(reportedStderrLength)))
        process.stderr.write(`${url}: ${error}\n`);
      reportedStderrLength = stderr.length;
    }
  } finally {
    await browser.close();
  }
}

await main();
