import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  renderAreaIndex,
  renderCatalog,
  renderDecisions,
  renderRequirements,
  renderRoadmap,
} from './render.mjs';

const milestones = [
  { id: 'M1', title: 'M1 · Một', goal: 'Mục tiêu một' },
  { id: 'M2', title: 'M2 · Hai', goal: 'Mục tiêu hai' },
];
const requirements = [
  {
    id: 'REQ-001',
    title: 'Đăng nhập | có ký tự đặc biệt',
    description: 'Mô tả',
    status: 'accepted',
    priority: 'must',
    milestone: 'M1',
    area: 'identity',
    sources: ['mentor-brief'],
  },
];

test('sổ yêu cầu nhóm theo milestone và bỏ milestone rỗng', () => {
  const page = renderRequirements(requirements, milestones);
  assert.match(page, /## M1 · Một/);
  assert.doesNotMatch(page, /## M2 · Hai/);
  assert.match(page, /Đã chốt/);
  assert.match(page, /`mentor-brief`/);
});

test('ký tự gạch đứng trong tiêu đề không làm vỡ bảng', () => {
  assert.match(renderRequirements(requirements, milestones), /Đăng nhập \\\| có/);
});

test('sổ quyết định có link tới từng tệp ADR', () => {
  const page = renderDecisions([
    { id: 'ADR-0001', file: 'ADR-0001-a.md', title: 'Một repo', status: 'accepted' },
  ]);
  assert.match(page, /\[ADR-0001\]\(\.\/ADR-0001-a\.md\)/);
});

test('lộ trình báo milestone chưa có yêu cầu', () => {
  const page = renderRoadmap(requirements, milestones);
  assert.match(page, /M1 · Một \| Mục tiêu một \| REQ-001/);
  assert.match(page, /M2 · Hai \| Mục tiêu hai \| Chưa có/);
});

const components = [
  {
    id: 'identity',
    path: 'services/identity',
    kind: 'service',
    stack: 'NestJS',
    summary: 'Đăng nhập | token',
    milestone: 'M1',
  },
  {
    id: 'web-3d',
    path: 'apps/web-3d',
    kind: 'app',
    stack: 'Next.js',
    summary: 'Web 3D',
    milestone: 'M1',
  },
];
const areas = [
  { path: 'services', summary: 'Tiến trình phục vụ API' },
  { path: 'infra', summary: 'Hạ tầng chạy hệ thống' },
];

test('trang chỉ mục của một thư mục chỉ liệt kê thành phần nằm trong nó, có liên kết', () => {
  const page = renderAreaIndex(areas[0], components);
  assert.ok(page.startsWith('# services\n'));
  assert.ok(page.includes('Tiến trình phục vụ API'));
  assert.ok(page.includes('[`identity`](./identity/README.md)'));
  assert.ok(!page.includes('web-3d'));
});

test('thư mục không chứa thành phần thì trang chỉ mục không có bảng', () => {
  const page = renderAreaIndex(areas[1], components);
  assert.ok(page.includes('Hạ tầng chạy hệ thống'));
  assert.ok(!page.includes('| --- |'));
});

test('trang chỉ mục ghi rõ nó được sinh từ catalog', () => {
  assert.ok(renderAreaIndex(areas[1], components).includes('docs/catalog.yaml'));
});

test('danh sách thành phần mở đầu bằng bảng thư mục cấp cao kèm số thành phần', () => {
  const page = renderCatalog(components, areas);
  assert.ok(page.includes('| `services/` | Tiến trình phục vụ API | 1 |'));
  assert.ok(page.includes('| `infra/` | Hạ tầng chạy hệ thống | 0 |'));
  assert.ok(page.indexOf('## Thư mục cấp cao') < page.indexOf('## Thành phần'));
});
