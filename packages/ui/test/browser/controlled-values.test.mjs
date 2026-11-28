import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { findChrome, launchChrome, sleep } from '../../../../scripts/browser/cdp.mjs';
import { serveFixture } from '../support/library-browser.mjs';

const SHOWN = {
  segmented: `document.querySelector('[data-fixture="segmented"] [data-state="on"]')?.textContent`,
  swatch: `document.querySelector('[data-fixture="swatch"] [aria-checked="true"]')?.getAttribute('aria-label')`,
  grid: `document.querySelector('[data-fixture="grid"] [aria-checked="true"]')?.dataset.item`,
  slider: `document.querySelector('[data-fixture="slider"] [role="slider"]')?.getAttribute('aria-valuenow')`,
  stepper: `document.querySelector('[data-fixture="stepper"] input')?.value`,
};
const CASES = [
  { id: 'segmented', name: 'SegmentedControl', next: 'night', shown: 'Night' },
  { id: 'swatch', name: 'ColorSwatch', next: 'pink', shown: 'Pink' },
  { id: 'grid', name: 'ItemGrid', next: 'scarf', shown: 'scarf' },
  { id: 'slider', name: 'Slider', next: 175, shown: '175' },
  { id: 'stepper', name: 'NumberStepper', next: 5, shown: '5' },
];

const chrome = findChrome();
let fixture;

before(async () => {
  if (chrome) fixture = await serveFixture('controlled-values');
});

after(() => fixture?.close());

test(
  'bỏ điều khiển thì component giữ giá trị có điều khiển cuối cùng',
  { timeout: 120000 },
  async (context) => {
    if (!chrome) {
      context.skip('không có Chrome');
      return;
    }
    const browser = await launchChrome({ width: 1024, height: 900 });
    try {
      await browser.openPage(`${fixture.origin}/`);
      await browser.waitFor(`window.fixture && ${SHOWN.stepper} === '2'`);
      for (const { id, name, next, shown } of CASES) {
        await browser.evaluate(`window.fixture.control('${id}', ${JSON.stringify(next)})`);
        await browser.waitFor(`${SHOWN[id]} === '${shown}'`, 3000);
        await browser.evaluate(`window.fixture.release('${id}')`);
        await sleep(100);
        assert.equal(await browser.evaluate(SHOWN[id]), shown, name);
      }
    } finally {
      await browser.close();
    }
  },
);
