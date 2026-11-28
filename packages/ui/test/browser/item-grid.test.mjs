import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome } from '../../../../scripts/browser/cdp.mjs';
import { press, serveFixture } from '../support/library-browser.mjs';

const ITEMS = `[...document.querySelectorAll('.nv-item-grid__item')]`;
const FOCUSED = `${ITEMS}.indexOf(document.activeElement)`;
const CHECKED = `${ITEMS}.findIndex((item) => item.getAttribute('aria-checked') === 'true')`;

const chrome = findChrome();
let fixture;

before(async () => {
  if (chrome) fixture = await serveFixture('item-grid');
});

after(() => fixture?.close());

async function arrow(browser, key) {
  await press(browser, key);
  return [await browser.evaluate(FOCUSED), await browser.evaluate(CHECKED)];
}

test('lưới đồ đi giữa các hàng bằng mũi tên lên xuống', { timeout: 120000 }, async (context) => {
  if (!chrome) {
    context.skip('không có Chrome');
    return;
  }
  const browser = await launchChrome({ width: 1024, height: 900 });
  try {
    await browser.openPage(`${fixture.origin}/`);
    await browser.waitFor(`${ITEMS}.length === 10`);
    assert.equal(
      await browser.evaluate(
        `getComputedStyle(document.querySelector('.nv-item-grid__items')).gridTemplateColumns.split(' ').length`,
      ),
      4,
    );
    await browser.evaluate(`${ITEMS}[0].focus()`);
    assert.deepEqual(await arrow(browser, 'ArrowDown'), [4, 4]);
    assert.deepEqual(await arrow(browser, 'ArrowDown'), [8, 8]);
    assert.deepEqual(await arrow(browser, 'ArrowDown'), [8, 8]);
    assert.deepEqual(await arrow(browser, 'ArrowUp'), [4, 4]);
    await browser.evaluate(`${ITEMS}[1].focus()`);
    assert.deepEqual(await arrow(browser, 'ArrowDown'), [5, 4]);
    await browser.evaluate(`${ITEMS}[6].focus()`);
    assert.deepEqual((await arrow(browser, 'ArrowDown'))[0], 9);
  } finally {
    await browser.close();
  }
});
