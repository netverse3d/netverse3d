import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome, sleep } from '../../../../scripts/browser/cdp.mjs';
import { press, serveLibrary } from '../support/library-browser.mjs';

const TOASTS = `document.querySelectorAll('.nv-notices-preview .nv-toast-stack li')`;
const POPOVER = `document.querySelector('.nv-popover')`;
const POPOVER_TRIGGER = `document.querySelector('.nv-overlays-preview [aria-haspopup="dialog"]')`;
const SHOW_AGAIN = `[...document.querySelectorAll('.nv-notices-preview button')].find((button) => button.textContent === 'Hiện lại thông báo')`;

const chrome = findChrome();
let library;

before(async () => {
  if (chrome) library = await serveLibrary();
});

after(() => library?.close());

test('thông báo hiện lúc lớp nổi đang mở không giữ mất phím Escape', async (context) => {
  if (!chrome) {
    context.skip('không có Chrome');
    return;
  }
  const browser = await launchChrome({ width: 1280, height: 800 });
  try {
    await browser.openPage(`${library.origin}/`);
    await browser.waitFor(`${TOASTS}.length === 3 && ${POPOVER_TRIGGER}`);
    await browser.evaluate(`${TOASTS}[0].querySelector('button[aria-label]').click()`);
    await browser.waitFor(`${TOASTS}.length === 2`);

    await browser.evaluate(`${POPOVER_TRIGGER}.focus()`);
    await press(browser, 'Enter');
    await browser.waitFor(`${POPOVER} && ${POPOVER}.getAnimations().length === 0`);
    await browser.evaluate(`(${SHOW_AGAIN}).click()`);
    await browser.waitFor(`${TOASTS}.length === 3`);
    await sleep(300);

    await press(browser, 'Escape');
    await browser.waitFor(`!${POPOVER}`, 3000);
    assert.equal(await browser.evaluate(`${TOASTS}.length`), 3);
  } finally {
    await browser.close();
  }
});

test('Escape trong thông báo đóng đúng thông báo đó, focus ở lại vùng thông báo', async (context) => {
  if (!chrome) {
    context.skip('không có Chrome');
    return;
  }
  const browser = await launchChrome({ width: 1280, height: 800 });
  try {
    await browser.openPage(`${library.origin}/`);
    await browser.waitFor(`${TOASTS}.length === 3`);
    const closing = await browser.evaluate(
      `(() => { const item = ${TOASTS}[1]; item.querySelector('button[aria-label]').focus(); return item.dataset.noticeTone; })()`,
    );
    await press(browser, 'Escape');
    await browser.waitFor(`${TOASTS}.length === 2`);
    assert.equal(
      await browser.evaluate(
        `[...${TOASTS}].some((item) => item.dataset.noticeTone === ${JSON.stringify(closing)})`,
      ),
      false,
    );
    assert.equal(
      await browser.evaluate(
        `document.querySelector('.nv-notices-preview .nv-toast-stack').contains(document.activeElement)`,
      ),
      true,
    );
  } finally {
    await browser.close();
  }
});
