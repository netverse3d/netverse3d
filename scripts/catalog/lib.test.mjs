import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkAllComponents, checkStructure, loadAreas } from './lib.mjs';

const CATALOG = `components:
  - id: identity
    path: services/identity
    kind: service
    stack: NestJS
    summary: Auth
    milestone: M1
`;

const AREAS = `areas:
  - path: services
    summary: Services
  - path: docs
    summary: Documents
`;

function write(root, file, content = '') {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

function createRepository(provenance = 'none') {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  write(root, 'docs/catalog.yaml', `${CATALOG}${AREAS}`);
  write(root, 'services/identity/README.md', '# identity\n');
  write(root, 'services/identity/component.yaml', `provenance: ${provenance}\n`);
  return root;
}

function addCompleteService(root) {
  write(root, 'services/identity/package.json', '{}');
  write(root, 'services/identity/Dockerfile');
  write(root, 'services/identity/.env.example');
  write(root, 'services/identity/openapi.yaml');
  write(root, 'services/identity/src/health.ts', "app.get('/livez'); app.get('/healthz');");
  write(root, 'services/identity/test/health.test.ts');
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

test('báo README ghi milestone khác catalog', () => {
  const root = createRepository();
  write(root, 'services/identity/README.md', '# identity\n\n- Milestone: M3\n');
  assert.match(checkStructure(root).join(), /README\.md says milestone M3 but the catalog says M1/);
});

test('nhận README ghi đúng milestone của catalog', () => {
  const root = createRepository();
  write(root, 'services/identity/README.md', '# identity\n\n- Milestone: M1\n');
  assert.deepEqual(checkStructure(root), []);
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

test('báo thư mục cấp cao chưa khai trong areas', () => {
  const root = createRepository();
  write(root, 'tools/run.mjs');
  assert.match(checkStructure(root).join(), /tools: top-level directory is not in areas/);
});

test('bỏ qua thư mục ẩn và thư mục sinh ra khi dựng', () => {
  const root = createRepository();
  write(root, '.github/workflows/ci.yml');
  write(root, 'node_modules/yaml/index.js');
  assert.deepEqual(checkStructure(root), []);
});

test('bỏ qua thư mục cấp cao bị git bỏ qua', () => {
  const root = createRepository();
  execFileSync('git', ['init', '-q'], { cwd: root });
  write(root, '.gitignore', 'scratch/\n');
  write(root, 'scratch/notes.md');
  assert.deepEqual(checkStructure(root), []);
});

test('báo areas trỏ tới thư mục không tồn tại', () => {
  const root = createRepository();
  write(root, 'docs/catalog.yaml', `${CATALOG}${AREAS}  - path: tests\n    summary: Tests\n`);
  assert.match(checkStructure(root).join(), /tests: listed in areas but the directory is missing/);
});

test('báo areas thiếu mô tả hoặc khai trùng', () => {
  const root = createRepository();
  write(root, 'docs/catalog.yaml', `${CATALOG}${AREAS}  - path: docs\n`);
  const errors = checkStructure(root).join();
  assert.match(errors, /docs: duplicate area/);
  assert.match(errors, /docs: area is missing summary/);
});

test('báo gốc chứa thành phần chưa khai trong areas', () => {
  const root = createRepository();
  write(root, 'docs/catalog.yaml', `${CATALOG}areas:\n  - path: docs\n    summary: Documents\n`);
  assert.match(checkStructure(root).join(), /services: top-level directory is not in areas/);
});

test('báo depends_on trỏ tới thành phần không có', () => {
  const root = createRepository();
  write(root, 'docs/catalog.yaml', `${CATALOG.trimEnd()}\n    depends_on: [contracts]\n${AREAS}`);
  assert.match(
    checkStructure(root).join(),
    /services\/identity: depends_on "contracts" is not a component/,
  );
});

test('báo depends_on trỏ về chính nó hoặc không phải danh sách', () => {
  const root = createRepository();
  write(root, 'docs/catalog.yaml', `${CATALOG.trimEnd()}\n    depends_on: [identity]\n${AREAS}`);
  assert.match(checkStructure(root).join(), /services\/identity: depends_on cannot name itself/);
  write(root, 'docs/catalog.yaml', `${CATALOG.trimEnd()}\n    depends_on: contracts\n${AREAS}`);
  assert.match(checkStructure(root).join(), /services\/identity: depends_on must be a list/);
});

test('đọc được danh sách areas của catalog', () => {
  assert.deepEqual(
    loadAreas(createRepository()).map((area) => area.path),
    ['services', 'docs'],
  );
});

test('báo service chỉ có endpoint sẵn sàng mà thiếu endpoint còn sống', () => {
  const root = createRepository('original');
  addCompleteService(root);
  write(root, 'services/identity/src/health.ts', "app.get('/healthz');");
  const text = checkAllComponents(root).join();
  assert.ok(text.includes('no /livez endpoint found'), text);
  assert.ok(!text.includes('no /healthz endpoint found'), text);
});

test('báo service chỉ có endpoint còn sống mà thiếu endpoint sẵn sàng', () => {
  const root = createRepository('original');
  addCompleteService(root);
  write(root, 'services/identity/src/health.ts', "app.get('/livez');");
  const text = checkAllComponents(root).join();
  assert.ok(text.includes('no /healthz endpoint found'), text);
  assert.ok(!text.includes('no /livez endpoint found'), text);
});

test('chặn tệp test nằm trong src của service, vì test phải ở thư mục test riêng', () => {
  const root = createRepository('original');
  addCompleteService(root);
  write(root, 'services/identity/src/login.spec.ts');
  const text = checkAllComponents(root).join();
  assert.ok(
    text.includes('services/identity: test file src/login.spec.ts must live under test/'),
    text,
  );
});

test('nhận service có test nằm trong thư mục test riêng', () => {
  const root = createRepository('original');
  addCompleteService(root);
  write(root, 'services/identity/test/unit/login.spec.ts');
  const text = checkAllComponents(root).join();
  assert.ok(!text.includes('must live under test/'), text);
});
