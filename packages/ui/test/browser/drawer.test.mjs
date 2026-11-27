import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome, sleep } from '../../../../scripts/browser/cdp.mjs';
import { press, serveLibrary } from '../support/library-browser.mjs';

const DRAWER = `document.querySelector('[role="dialog"].nv-drawer')`;
const TRIGGER = `document.querySelector('[data-drawer-trigger]')`;
const TOASTS = `document.querySelectorAll('.nv-notices-preview .nv-toast-stack li')`;
const SHOW_AGAIN = `[...document.querySelectorAll('.nv-notices-preview button')].find((button) => button.textContent === 'Hiện lại thông báo')`;

const chrome = findChrome();
let library;

before(async () => {
  if (chrome) library = await serveLibrary();
});

after(() => library?.close());

async function loadLibrary(browser) {
  await browser.openPage(`${library.origin}/`);
  await browser.waitFor(`${TRIGGER} && ${TOASTS}.length === 3`);
}

async function openDrawer(browser) {
  await browser.evaluate(`${TRIGGER}.focus()`);
  await press(browser, 'Enter');
  await browser.waitFor(`${DRAWER} && ${DRAWER}.getAnimations().length === 0`);
  assert.equal(await browser.evaluate(`${DRAWER}.contains(document.activeElement)`), true);
}

async function closesWithEscape(browser) {
  await press(browser, 'Escape');
  await browser.waitFor(`!${DRAWER}`, 3000);
  await browser.waitFor(`document.activeElement === ${TRIGGER}`, 2000);
}

test('ngăn kéo đóng bằng Escape và trả focus', { timeout: 120000 }, async (context) => {
  if (!chrome) {
    context.skip('không có Chrome');
    return;
  }
  const browser = await launchChrome({ width: 1280, height: 800 });
  try {
    await loadLibrary(browser);
    await openDrawer(browser);
    await closesWithEscape(browser);
    assert.equal(await browser.evaluate(`${TOASTS}.length`), 3);
  } finally {
    await browser.close();
  }
});

test(
  'thông báo đến lúc ngăn kéo đang mở không giữ mất Escape',
  { timeout: 120000 },
  async (context) => {
    if (!chrome) {
      context.skip('không có Chrome');
      return;
    }
    const browser = await launchChrome({ width: 1280, height: 800 });
    try {
      await loadLibrary(browser);
      await browser.evaluate(`${TOASTS}[0].querySelector('button[aria-label]').click()`);
      await browser.waitFor(`${TOASTS}.length === 2`);
      await openDrawer(browser);
      await browser.evaluate(`(${SHOW_AGAIN}).click()`);
      await browser.waitFor(`${TOASTS}.length === 3`);
      await sleep(300);
      await closesWithEscape(browser);
    } finally {
      await browser.close();
    }
  },
);
