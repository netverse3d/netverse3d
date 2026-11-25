import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadRegistry } from '../../src/registry-file.mjs';
import { componentProps, registeredComponents } from '../../src/registry.mjs';
import { loadDemos } from '../support/demos.mjs';

const registry = loadRegistry();
const css = readFileSync(new URL('../../components/components.css', import.meta.url), 'utf8');
const criteria = readFileSync(
  new URL('../../../../docs/wiki/product/ui-criteria.md', import.meta.url),
  'utf8',
);
const IMPLICIT_VALUES = new Set(['none', 'idle']);

test('mọi khối CSS component đều đã đăng ký', () => {
  const registered = new Set(registry.components.map((entry) => entry.className));
  const blocks = new Set([...css.matchAll(/\.(nv-[a-z-]+)(?![\w-]*__)/g)].map((match) => match[1]));
  for (const block of blocks) assert.ok(registered.has(block), `${block} chưa có trong sổ đăng ký`);
});

test('mọi mục đăng ký có khối CSS tương ứng', () => {
  for (const entry of registry.components) {
    assert.ok(
      [...css.matchAll(/\.(nv-[\w-]+)/g)].some((match) => match[1] === entry.className),
      entry.id,
    );
  }
});

test('mọi giá trị tham số trong sổ đăng ký có quy tắc CSS', () => {
  for (const entry of registry.components) {
    for (const [prop, values] of Object.entries(componentProps(registry, entry))) {
      for (const value of values.slice(1)) {
        if (IMPLICIT_VALUES.has(value)) continue;
        const found =
          css.includes(`[data-${prop}='${value}']`) ||
          (value === 'disabled' && css.includes(`.${entry.className}:disabled`));
        assert.ok(found, `${entry.id}: ${prop}=${value}`);
      }
    }
  }
});

test('mọi component đăng ký có mẫu React trong thư viện', async () => {
  const { DEMO_IDS, renderDemo } = await loadDemos();
  for (const entry of registeredComponents(registry)) {
    assert.ok(DEMO_IDS.includes(entry.demo), `${entry.id}: ${entry.demo}`);
    assert.ok(
      renderDemo(registry, entry).includes(entry.className),
      `${entry.id}: ${entry.className}`,
    );
  }
});

test('tên React của component không trùng nhau', () => {
  const names = registry.components.filter((entry) => entry.react).map((entry) => entry.react);
  assert.equal(new Set(names).size, names.length);
});

test('mã tiêu chí trong sổ đăng ký có trên trang tiêu chí giao diện', () => {
  for (const entry of registry.components) {
    for (const code of entry.criteria)
      assert.ok(criteria.includes(`**${code}**`), `${entry.id}: ${code}`);
  }
});
