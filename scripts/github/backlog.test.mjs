import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { loadRegistry } from '../trace/lib.mjs';
import { planBacklog, planMilestoneMoves, selectMissingIssues } from './backlog.mjs';

const requirements = [
  {
    id: 'REQ-001',
    title: 'Đăng nhập',
    status: 'accepted',
    priority: 'must',
    milestone: 'M1',
    area: 'identity',
    sources: ['mentor-brief'],
  },
  {
    id: 'REQ-002',
    title: 'Đã bỏ',
    status: 'deprecated',
    priority: 'must',
    milestone: 'M1',
    area: 'identity',
    sources: ['mentor-brief'],
  },
];
const milestones = [{ id: 'M1', title: 'M1 · Một' }];

test('mỗi yêu cầu còn hiệu lực có một issue cha, bỏ qua yêu cầu đã bỏ', () => {
  const { issues } = planBacklog(requirements, { tasks: [] }, milestones);
  assert.deepEqual(
    issues.map((issue) => issue.title),
    ['REQ-001: Đăng nhập'],
  );
  assert.equal(issues[0].type, 'Feature');
  assert.equal(issues[0].priority, 'P1');
  assert.equal(issues[0].milestone, 'M1 · Một');
});

test('việc con gắn đúng yêu cầu cha, có nhãn và cỡ', () => {
  const seed = {
    tasks: [
      {
        requirement: 'REQ-001',
        items: [
          { title: 'Làm form', size: 'M' },
          { title: 'Chốt', size: 'S', labels: ['blocked'] },
        ],
      },
    ],
  };
  const { issues } = planBacklog(requirements, seed, milestones);
  const form = issues.find((issue) => issue.title === 'Làm form');
  assert.equal(form.parent, 'REQ-001');
  assert.equal(form.size, 'M');
  assert.equal(form.status, 'Ready');
  assert.match(form.body, /REQ-001/);
  const blocked = issues.find((issue) => issue.title === 'Chốt');
  assert.equal(blocked.status, 'Backlog');
  assert.ok(blocked.labels.includes('blocked'));
});

test('việc của yêu cầu còn nháp chưa được coi là sẵn sàng', () => {
  const draft = { ...requirements[0], id: 'REQ-003', status: 'draft' };
  const seed = { tasks: [{ requirement: 'REQ-003', items: [{ title: 'Làm', size: 'S' }] }] };
  const { issues } = planBacklog([draft], seed, milestones);
  assert.equal(issues.find((issue) => issue.title === 'Làm').status, 'Backlog');
});

test('bỏ qua việc của yêu cầu đã bỏ mà không lỗi', () => {
  const seed = { tasks: [{ requirement: 'REQ-002', items: [{ title: 'Làm', size: 'S' }] }] };
  const { issues, errors } = planBacklog(requirements, seed, milestones);
  assert.deepEqual(errors, []);
  assert.equal(
    issues.some((issue) => issue.title === 'Làm'),
    false,
  );
});

test('đổi tiêu đề yêu cầu không tạo trùng issue cha', () => {
  const issues = [{ key: 'REQ-001', type: 'Feature', title: 'REQ-001: Tên mới' }];
  assert.deepEqual(selectMissingIssues(issues, ['REQ-001: Tên cũ']), []);
});

test('báo lỗi khi việc trỏ tới yêu cầu không tồn tại', () => {
  const { errors } = planBacklog(
    requirements,
    { tasks: [{ requirement: 'REQ-999', items: [] }] },
    milestones,
  );
  assert.match(errors.join(), /REQ-999/);
});

test('báo lỗi khi yêu cầu có milestone không tồn tại', () => {
  const { errors } = planBacklog(requirements, { tasks: [] }, []);
  assert.match(errors.join(), /unknown milestone/);
});

test('chạy lại không tạo trùng issue đã có', () => {
  const issues = [{ title: 'A' }, { title: 'B' }];
  assert.deepEqual(selectMissingIssues(issues, ['A']), [{ title: 'B' }]);
  assert.deepEqual(selectMissingIssues(issues, ['A', 'B']), []);
});

test('dời issue đang mở sang milestone mới khi yêu cầu đổi mốc', () => {
  const planned = [
    { key: 'REQ-008', type: 'Feature', title: 'REQ-008: Thông báo', milestone: 'M3 · Ba' },
    { key: 'REQ-008/Gửi email', type: 'Task', title: 'Gửi email', milestone: 'M3 · Ba' },
  ];
  const existing = [
    { number: 5, title: 'REQ-008: Thông báo cũ', state: 'open', milestone: { title: 'M2 · Hai' } },
    { number: 6, title: 'Gửi email', state: 'open', milestone: { title: 'M2 · Hai' } },
  ];
  assert.deepEqual(planMilestoneMoves(planned, existing), [
    { number: 5, from: 'M2 · Hai', to: 'M3 · Ba' },
    { number: 6, from: 'M2 · Hai', to: 'M3 · Ba' },
  ]);
});

test('không dời issue đã đóng, đã đúng mốc hoặc không do sổ yêu cầu sinh ra', () => {
  const planned = [{ key: 'REQ-008', type: 'Feature', title: 'REQ-008: A', milestone: 'M3 · Ba' }];
  const existing = [
    { number: 5, title: 'REQ-008: A', state: 'closed', milestone: { title: 'M2 · Hai' } },
    { number: 6, title: 'REQ-008: A', state: 'open', milestone: { title: 'M3 · Ba' } },
    { number: 7, title: 'Việc tự tạo', state: 'open', milestone: { title: 'M2 · Hai' } },
  ];
  assert.deepEqual(planMilestoneMoves(planned, existing), []);
});

test('bộ issue thật của dự án hợp lệ và không trùng tiêu đề', () => {
  const seed = parse(readFileSync('docs/requirements/backlog-seed.yaml', 'utf8'));
  const realMilestones = parse(
    readFileSync('docs/requirements/milestones.yaml', 'utf8'),
  ).milestones;
  const { issues, errors } = planBacklog(loadRegistry(process.cwd()), seed, realMilestones);
  assert.deepEqual(errors, []);
  const titles = issues.map((issue) => issue.title);
  assert.equal(new Set(titles).size, titles.length);
});
