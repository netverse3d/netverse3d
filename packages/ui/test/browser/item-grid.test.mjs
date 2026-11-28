import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome } from '../../../../scripts/browser/cdp.mjs';
import { press, serveFixture } from '../support/library-browser.mjs';

const itemsIn = (fixture) =>
  `[...document.querySelectorAll('[data-fixture="${fixture}"] .nv-item-grid__item')]`;

const chrome = findChrome();
let fixture;

before(async () => {
  if (chrome) fixture = await serveFixture('item-grid');
});

after(() => fixture?.close());

async function arrow(browser, items, key) {
  await press(browser, key);
  return [
    await browser.evaluate(`${items}.indexOf(document.activeElement)`),
    await browser.evaluate(
      `${items}.findIndex((item) => item.getAttribute('aria-checked') === 'true')`,
    ),
  ];
}

test(
  'lưới đồ đi giữa các hàng bằng mũi tên lên xuống, kể cả khi nằm trong form',
  { timeout: 120000 },
  async (context) => {
    if (!chrome) {
      context.skip('không có Chrome');
      return;
    }
    const browser = await launchChrome({ width: 1024, height: 900 });
    try {
      await browser.openPage(`${fixture.origin}/`);
      for (const fixture of ['plain', 'form']) {
        const items = itemsIn(fixture);
        await browser.waitFor(`${items}.length === 10`);
        assert.equal(
          await browser.evaluate(
            `getComputedStyle(${items}[0].parentElement).gridTemplateColumns.split(' ').length`,
          ),
          4,
        );
        await browser.evaluate(`${items}[0].focus()`);
        assert.deepEqual(await arrow(browser, items, 'ArrowDown'), [4, 4], fixture);
        assert.deepEqual(await arrow(browser, items, 'ArrowDown'), [8, 8], fixture);
        assert.deepEqual(await arrow(browser, items, 'ArrowDown'), [8, 8], fixture);
        assert.deepEqual(await arrow(browser, items, 'ArrowUp'), [4, 4], fixture);
        await browser.evaluate(`${items}[1].focus()`);
        assert.deepEqual(await arrow(browser, items, 'ArrowDown'), [5, 4], fixture);
        await browser.evaluate(`${items}[6].focus()`);
        assert.equal((await arrow(browser, items, 'ArrowDown'))[0], 9, fixture);
      }
    } finally {
      await browser.close();
    }
  },
);
