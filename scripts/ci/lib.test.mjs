import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { concludeRun, findUnitsWithoutJob, loadUnits, selectUnits } from './lib.mjs';

const components = [
  { id: 'contracts', path: 'packages/contracts' },
  { id: 'game-assets', path: 'packages/game-assets' },
  { id: 'web-3d', path: 'apps/web-3d' },
  { id: 'identity', path: 'services/identity' },
  { id: 'ui', path: 'packages/ui' },
];
const dependencies = new Map([
  ['contracts', []],
  ['game-assets', ['contracts']],
  ['web-3d', ['game-assets', 'contracts']],
  ['identity', ['contracts']],
  ['ui', []],
]);
const units = [
  { id: 'contracts', path: 'packages/contracts', package: '@netverse/contracts' },
  { id: 'game-assets', path: 'packages/game-assets', package: '@netverse/game-assets' },
  { id: 'web-3d', path: 'apps/web-3d', package: '@netverse/web-3d' },
  { id: 'identity', path: 'services/identity', package: '@netverse/identity' },
  { id: 'docs', path: 'docs', package: '@netverse/docs', standalone: true },
];

function ids(files) {
  return selectUnits(units, components, dependencies, files).map((unit) => unit.id);
}

test('chỉ sửa một service thì chỉ service đó được kiểm', () => {
  assert.deepEqual(ids(['services/identity/src/main.ts']), ['identity']);
});

test('sửa package dùng chung thì kiểm cả thành phần phụ thuộc nó', () => {
  assert.deepEqual(ids(['packages/game-assets/runtime/look.mjs']), ['game-assets', 'web-3d']);
});

test('sửa tài liệu thì chỉ dựng trang tài liệu', () => {
  assert.deepEqual(ids(['docs/wiki/a.md']), ['docs']);
});

test('sửa công cụ repo thì không thành phần nào được kiểm', () => {
  assert.deepEqual(ids(['scripts/catalog/lib.mjs', 'README.md']), []);
});

test('thành phần giữ chỗ chưa có manifest không sinh job', () => {
  assert.deepEqual(ids(['packages/ui/README.md']), []);
});

test('sửa tệp gốc dùng chung thì kiểm tất cả', () => {
  assert.equal(ids(['tsconfig.base.json']).length, units.length);
  assert.equal(ids(['pnpm-lock.yaml']).length, units.length);
});

test('sửa cấu hình lint hoặc chính workflow CI thì kiểm tất cả', () => {
  assert.equal(ids(['eslint.config.mjs']).length, units.length);
  assert.equal(ids(['.github/workflows/ci.yml']).length, units.length);
});

test('không biết tệp nào đổi thì kiểm tất cả', () => {
  assert.equal(ids(null).length, units.length);
});

test('mọi job xanh thì kết luận xanh', () => {
  assert.deepEqual(
    concludeRun({
      repo: { result: 'success' },
      plan: { result: 'success', outputs: { any: 'true' } },
      unit: { result: 'success' },
    }),
    [],
  );
});

test('không thành phần nào bị ảnh hưởng thì job thành phần bị bỏ qua vẫn kết luận xanh', () => {
  assert.deepEqual(
    concludeRun({
      repo: { result: 'success' },
      plan: { result: 'success', outputs: { any: 'false' } },
      unit: { result: 'skipped' },
    }),
    [],
  );
});

test('một job thành phần đỏ thì kết luận đỏ', () => {
  const errors = concludeRun({
    repo: { result: 'success' },
    plan: { result: 'success', outputs: { any: 'true' } },
    unit: { result: 'failure' },
  });
  assert.deepEqual(errors, ['unit: failure']);
});

test('job thành phần bị bỏ qua trong lúc có thành phần cần kiểm thì kết luận đỏ', () => {
  const errors = concludeRun({
    repo: { result: 'success' },
    plan: { result: 'success', outputs: { any: 'true' } },
    unit: { result: 'skipped' },
  });
  assert.deepEqual(errors, ['unit: skipped']);
});

test('kiểm chung của repo đỏ hoặc bị huỷ thì kết luận đỏ', () => {
  assert.deepEqual(
    concludeRun({
      repo: { result: 'failure' },
      plan: { result: 'success', outputs: { any: 'false' } },
      unit: { result: 'skipped' },
    }),
    ['repo: failure'],
  );
  assert.deepEqual(
    concludeRun({
      repo: { result: 'cancelled' },
      plan: { result: 'success', outputs: { any: 'false' } },
      unit: { result: 'skipped' },
    }),
    ['repo: cancelled'],
  );
});

test('bước lập danh sách đỏ thì kết luận đỏ dù job thành phần bị bỏ qua', () => {
  const errors = concludeRun({
    repo: { result: 'success' },
    plan: { result: 'failure', outputs: {} },
    unit: { result: 'skipped' },
  });
  assert.deepEqual(errors, ['plan: failure', 'unit: skipped']);
});

test('thiếu kết quả của một job bắt buộc thì kết luận đỏ', () => {
  assert.deepEqual(concludeRun({ repo: { result: 'success' } }), [
    'plan: missing',
    'unit: missing',
  ]);
});

test('thành phần có mã nhưng chưa có cách kiểm trong CI bị nêu tên', () => {
  const stacks = new Map([
    ['game', 'go.mod'],
    ['identity', null],
  ]);
  const withoutJob = findUnitsWithoutJob(
    [
      { id: 'game', path: 'services/game' },
      { id: 'identity', path: 'services/identity' },
      { id: 'web-3d', path: 'apps/web-3d' },
    ],
    units,
    (component) => stacks.get(component.id) ?? null,
  );
  assert.deepEqual(withoutJob, ['game: has go.mod but CI has no job for it yet']);
});

test('đơn vị có script test đầu cuối được đánh dấu để CI bật database', () => {
  const root = mkdtempSync(join(tmpdir(), 'ci-units-'));
  const write = (file, content) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  };
  write(
    'services/media/package.json',
    '{"name":"@netverse/media","scripts":{"test":"jest","test:e2e":"jest --config e2e.json"}}',
  );
  write(
    'packages/contracts/package.json',
    '{"name":"@netverse/contracts","scripts":{"test":"node --test"}}',
  );
  const loaded = loadUnits(
    root,
    [
      { id: 'media', path: 'services/media' },
      { id: 'contracts', path: 'packages/contracts' },
      { id: 'identity', path: 'services/identity' },
    ],
    [],
  );
  assert.deepEqual(
    loaded.map((unit) => [unit.id, unit.e2e]),
    [
      ['media', true],
      ['contracts', false],
    ],
  );
});
