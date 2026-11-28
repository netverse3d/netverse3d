import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome, sleep } from '../../../../scripts/browser/cdp.mjs';
import { serveLibrary } from '../support/library-browser.mjs';

const GROUP_BUTTONS = `[...document.querySelectorAll('.nv-tooltip-group button')]`;
const OPEN_TOOLTIP = `document.querySelector('.nv-tooltip[data-state$="open"]')?.firstChild?.textContent`;
const OPEN_STATE = `document.querySelector('.nv-tooltip[data-state$="open"]')?.dataset.state`;
const POINTER_FRAME_MS = 16;
const HOVER_TIMEOUT_MS = 3000;

const chrome = findChrome();
let library;

before(async () => {
  if (chrome) library = await serveLibrary();
});

after(() => library?.close());

async function hoverUntilOpen(browser, index, label) {
  const { x, y } = await browser.evaluate(`(() => {
    const bounds = ${GROUP_BUTTONS}[${index}].getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  })()`);
  const deadline = Date.now() + HOVER_TIMEOUT_MS;
  for (let nudge = 0; Date.now() < deadline; nudge = (nudge + 1) % 4) {
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + nudge, y });
    if ((await browser.evaluate(OPEN_TOOLTIP)) === label) return;
    await sleep(POINTER_FRAME_MS);
  }
  assert.fail(`tooltip ${label} không mở`);
}

test(
  'rê sang tooltip kế bên trong cùng nhóm thì hiện ngay, không chờ lại độ trễ',
  { timeout: 120000 },
  async (context) => {
    if (!chrome) {
      context.skip('không có Chrome');
      return;
    }
    const browser = await launchChrome({ width: 1280, height: 800 });
    try {
      await browser.openPage(`${library.origin}/`);
      await browser.waitFor(`${GROUP_BUTTONS}.length === 3`, 30000);
      await browser.evaluate(`${GROUP_BUTTONS}[0].scrollIntoView({ block: 'center' })`);
      await sleep(200);
      const labels = await browser.evaluate(
        `${GROUP_BUTTONS}.map((button) => button.getAttribute('aria-label'))`,
      );
      await hoverUntilOpen(browser, 0, labels[0]);
      await hoverUntilOpen(browser, 1, labels[1]);
      assert.equal(await browser.evaluate(OPEN_STATE), 'instant-open');
    } finally {
      await browser.close();
    }
  },
);
