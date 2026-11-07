import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { loadRegistry } from '../trace/lib.mjs';
import { planBacklog, selectMissingIssues } from './backlog.mjs';

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
