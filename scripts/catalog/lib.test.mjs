import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkAllComponents, checkStructure } from './lib.mjs';

const CATALOG = `components:
  - id: identity
    path: services/identity
    kind: service
    stack: NestJS
    summary: Auth
    milestone: M1
`;

function write(root, file, content = '') {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

function createRepository(provenance = 'none') {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  write(root, 'docs/catalog.yaml', CATALOG);
  write(root, 'services/identity/README.md', '# identity\n');
  write(root, 'services/identity/component.yaml', `provenance: ${provenance}\n`);
  return root;
}

function addCompleteService(root) {
  write(root, 'services/identity/package.json', '{}');
  write(root, 'services/identity/Dockerfile');
  write(root, 'services/identity/.env.example');
  write(root, 'services/identity/openapi.yaml');
  write(root, 'services/identity/src/health.ts', "app.get('/healthz');");
  write(root, 'services/identity/src/health.test.ts');
}

test('báo thư mục không có trong catalog', () => {
  const root = createRepository();
  write(root, 'services/rogue/README.md');
  assert.match(checkStructure(root).join(), /services\/rogue: directory is not in/);
});

test('báo mục catalog không có thư mục', () => {
  const root = createRepository();
  write(
    root,
    'docs/catalog.yaml',
    `${CATALOG}  - id: ghost
    path: services/ghost
    kind: service
    stack: NestJS
    summary: Ghost
    milestone: M1
`,
  );
  assert.match(checkStructure(root).join(), /services\/ghost: listed in the catalog/);
});

test('báo thành phần thiếu README', () => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  write(root, 'docs/catalog.yaml', CATALOG);
  write(root, 'services/identity/component.yaml', 'provenance: none\n');
  assert.match(checkStructure(root).join(), /missing README\.md/);
});

test('cấu trúc đúng thì không báo gì', () => {
  assert.deepEqual(checkStructure(createRepository()), []);
});

test('thành phần chỉ giữ chỗ thì được phép provenance none', () => {
  assert.deepEqual(checkAllComponents(createRepository()), []);
});

test('tệp bị git bỏ qua không được tính là mã của thành phần', () => {
  const root = createRepository();
  execFileSync('git', ['init', '-q'], { cwd: root });
  write(root, '.gitignore', 'notes.local.md\n');
  write(root, 'services/identity/notes.local.md', 'ghi chú riêng');
  assert.deepEqual(checkAllComponents(root), []);
});

test('chặn thành phần có mã mà chưa khai nguồn gốc', () => {
  const root = createRepository('none');
  addCompleteService(root);
  assert.match(checkAllComponents(root).join(), /has code but provenance is "none"/);
});

test('chặn nguồn gốc cleared khi không trỏ về ADR', () => {
  const root = createRepository('cleared');
  assert.match(checkAllComponents(root).join(), /needs provenance_ref/);
});

test('chặn giá trị nguồn gốc lạ', () => {
  const root = createRepository('copied');
  assert.match(checkAllComponents(root).join(), /provenance must be one of/);
});

test('báo service thiếu từng tệp bắt buộc', () => {
  const root = createRepository('original');
  write(root, 'services/identity/src/main.ts', 'export {};');
  const text = checkAllComponents(root).join('\n');
  assert.match(text, /missing a manifest/);
  assert.match(text, /missing Dockerfile/);
  assert.match(text, /missing \.env\.example/);
  assert.match(text, /has no test files/);
  assert.match(text, /missing openapi\.yaml/);
  assert.match(text, /no \/healthz endpoint/);
});

test('nhận service đủ chuẩn có mã do nhóm tự viết', () => {
  const root = createRepository('original');
  addCompleteService(root);
  assert.deepEqual(checkAllComponents(root), []);
});

test('nhận service đủ chuẩn có mã đã được phép và trỏ về ADR', () => {
  const root = createRepository('cleared\nprovenance_ref: ADR-0009');
  write(root, 'docs/decisions/ADR-0009-permission.md', '# ADR-0009\n');
  addCompleteService(root);
  assert.deepEqual(checkAllComponents(root), []);
});

test('chặn nguồn gốc cleared trỏ tới ADR không tồn tại', () => {
  const root = createRepository('cleared\nprovenance_ref: ADR-9999');
  assert.match(checkAllComponents(root).join(), /ADR-9999 does not exist/);
});
