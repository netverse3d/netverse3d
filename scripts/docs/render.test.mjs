import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderDecisions, renderRequirements, renderRoadmap } from './render.mjs';

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
