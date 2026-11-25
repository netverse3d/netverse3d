import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadRegistry } from '../../src/registry-file.mjs';
import { variantData, variantOptions } from '../../src/variants.mjs';
import { renderReactTypes } from '../../tools/react-types.mjs';

const registry = loadRegistry();

test('kiểu tham số React khớp sổ đăng ký', () => {
  const generated = readFileSync(
    new URL('../../react/variants.generated.ts', import.meta.url),
    'utf8',
  );
  assert.equal(generated, renderReactTypes(registry), 'chạy pnpm --filter @netverse/ui types');
});

test('mọi component React xuất ra đều đã đăng ký', () => {
  const index = readFileSync(new URL('../../react/index.ts', import.meta.url), 'utf8');
  const exported = [...index.matchAll(/export \{([^}]+)\}/g)].flatMap((match) =>
    match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const registered = new Set(
    registry.components.filter((entry) => entry.react).map((entry) => entry.react),
  );
  assert.ok(exported.length > 0);
  for (const name of exported) assert.ok(registered.has(name), `${name} chưa có trong sổ đăng ký`);
  for (const name of registered) assert.ok(exported.includes(name), `${name} chưa có bản React`);
});

test('chỉ ghi thuộc tính data cho giá trị khác mặc định', () => {
  const options = variantOptions(registry, 'Button');
  assert.deepEqual(variantData({ surface: 'filled', tone: 'accent', size: 'lg' }, options), {
    'data-surface': 'filled',
    'data-size': 'lg',
  });
});

test('giá trị tham số ngoài sổ đăng ký bị từ chối', () => {
  assert.throws(() => variantData({ tone: 'tím' }, variantOptions(registry, 'Button')));
  assert.throws(() => variantOptions(registry, 'FancyButton'));
});
