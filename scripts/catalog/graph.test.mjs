import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  affectedComponents,
  dependencyClosure,
  findDependencyCycle,
  loadDependencies,
  SHARED_ROOT_FILES,
} from './graph.mjs';

const components = [
  { id: 'contracts', path: 'packages/contracts' },
  { id: 'game-assets', path: 'packages/game-assets' },
  { id: 'nest-kit', path: 'packages/nest-kit' },
  { id: 'payment', path: 'services/payment' },
  { id: 'web-3d', path: 'apps/web-3d' },
  { id: 'game', path: 'services/game' },
];
const dependencies = new Map([
  ['contracts', []],
  ['game-assets', []],
  ['nest-kit', ['contracts']],
  ['payment', ['nest-kit']],
  ['web-3d', ['game-assets', 'contracts']],
  ['game', ['contracts']],
]);

function ids(files) {
  return affectedComponents(components, dependencies, files).map((component) => component.id);
}

function write(root, file, content) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

test('đổi một package chỉ ảnh hưởng thành phần phụ thuộc nó', () => {
  assert.deepEqual(ids(['packages/game-assets/runtime/look.mjs']), ['game-assets', 'web-3d']);
});

test('đổi hợp đồng ảnh hưởng cả thành phần phụ thuộc gián tiếp', () => {
  assert.deepEqual(ids(['packages/contracts/events/v1/envelope.schema.json']), [
    'contracts',
    'nest-kit',
    'payment',
    'web-3d',
    'game',
  ]);
});

test('đổi một service không ảnh hưởng thành phần khác', () => {
  assert.deepEqual(ids(['services/payment/src/main.ts']), ['payment']);
});

test('đổi tệp gốc dùng chung ảnh hưởng mọi thành phần', () => {
  assert.equal(ids(['tsconfig.base.json']).length, components.length);
  assert.equal(ids(['docs/a.md', 'pnpm-lock.yaml']).length, components.length);
  assert.ok(SHARED_ROOT_FILES.includes('pnpm-lock.yaml'));
});

test('đổi tài liệu hoặc công cụ repo không ảnh hưởng thành phần nào', () => {
  assert.deepEqual(ids(['docs/wiki/a.md', 'scripts/catalog/lib.mjs']), []);
});

test('không biết tệp nào đổi thì coi như mọi thành phần bị ảnh hưởng', () => {
  assert.equal(ids(null).length, components.length);
});

test('thư mục có tên bắt đầu giống nhau không bị nhận nhầm', () => {
  assert.deepEqual(ids(['services/payment-worker/a.ts']), []);
});

test('báo vòng phụ thuộc kèm đường đi', () => {
  const cycle = findDependencyCycle(
    new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]),
  );
  assert.deepEqual(cycle, ['a', 'b', 'c', 'a']);
});

test('đồ thị không có vòng thì không báo', () => {
  assert.equal(findDependencyCycle(dependencies), null);
});

test('đọc phụ thuộc từ package.json của workspace và từ depends_on của catalog', () => {
  const root = mkdtempSync(join(tmpdir(), 'graph-'));
  const catalog = [
    { id: 'contracts', path: 'packages/contracts' },
    { id: 'payment', path: 'services/payment' },
    { id: 'game', path: 'services/game', depends_on: ['contracts'] },
  ];
  write(root, 'packages/contracts/package.json', '{"name":"@netverse/contracts"}');
  write(
    root,
    'services/payment/package.json',
    '{"name":"@netverse/payment","dependencies":{"@netverse/contracts":"workspace:*","pg":"8"},"devDependencies":{"typescript":"6"}}',
  );
  write(root, 'services/game/go.mod', 'module game');
  const loaded = loadDependencies(root, catalog);
  assert.deepEqual(loaded.get('payment'), ['contracts']);
  assert.deepEqual(loaded.get('game'), ['contracts']);
  assert.deepEqual(loaded.get('contracts'), []);
});

test('phụ thuộc của một thành phần tính cả phần gián tiếp và không gồm chính nó', () => {
  assert.deepEqual(dependencyClosure('payment', dependencies), ['nest-kit', 'contracts']);
  assert.deepEqual(dependencyClosure('contracts', dependencies), []);
});
