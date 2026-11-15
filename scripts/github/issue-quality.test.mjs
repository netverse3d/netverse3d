import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import {
  parseIssueFormMetadata,
  applyIssueSyncPlan,
  planIssueSync,
  validateIssueMetadata,
} from './issue-quality.mjs';

function issue(overrides = {}) {
  return {
    type: 'Task',
    labels: ['area:infra'],
    milestone: 'M0 · Nền móng',
    fields: { Priority: 'High', Effort: 'Medium' },
    assignees: [],
    ...overrides,
  };
}

test('issue đủ metadata hợp lệ', () => {
  assert.deepEqual(validateIssueMetadata(issue()), []);
});

test('báo tất cả metadata bắt buộc đang thiếu', () => {
  assert.deepEqual(
    validateIssueMetadata(issue({ type: '', labels: [], milestone: '', fields: {} })),
    [
      'Type is required',
      'exactly one area:* label is required',
      'Milestone is required',
      'Priority is required',
      'Effort is required',
    ],
  );
});

test('chỉ chấp nhận đúng một nhãn area', () => {
  assert.deepEqual(validateIssueMetadata(issue({ labels: ['area:infra', 'area:media'] })), [
    'exactly one area:* label is required',
  ]);
});

test('từ chối lựa chọn Priority và Effort ngoài danh mục', () => {
  assert.deepEqual(validateIssueMetadata(issue({ fields: { Priority: 'P1', Effort: 'XL' } })), [
    'Priority has unsupported value: P1',
    'Effort has unsupported value: XL',
  ]);
});

test('issue Feature không bắt buộc có Effort', () => {
  assert.deepEqual(
    validateIssueMetadata(issue({ type: 'Feature', fields: { Priority: 'High' } })),
    [],
  );
});

const formBody = [
  '### Khu vực',
  '',
  'area:identity',
  '',
  '### Milestone',
  '',
  'M1 · Giao diện và Identity',
  '',
  '### Priority',
  '',
  'High',
  '',
  '### Effort',
  '',
  'Medium',
].join('\n');

test('workflow chạy khi mở hoặc sửa issue và chỉ nhận quyền ghi issue', () => {
  const workflow = parse(readFileSync('.github/workflows/issue-quality.yml', 'utf8'));
  assert.deepEqual(workflow.on.issues.types, ['opened', 'edited']);
  assert.deepEqual(workflow.permissions, { contents: 'read', issues: 'write' });
  assert.ok(
    workflow.jobs.sync.steps.some((step) => step.run?.includes('issue-quality.mjs --sync')),
  );
});

test('đọc metadata được chọn từ nội dung issue form', () => {
  assert.deepEqual(parseIssueFormMetadata(formBody), {
    area: 'area:identity',
    milestone: 'M1 · Giao diện và Identity',
    priority: 'High',
    effort: 'Medium',
  });
});

test('tạo kế hoạch đồng bộ metadata hợp lệ và gỡ needs-triage', () => {
  assert.deepEqual(
    planIssueSync(
      {
        type: { name: 'Task' },
        labels: [{ name: 'needs-triage' }, { name: 'backend' }],
        body: formBody,
      },
      {
        areaLabels: ['area:identity'],
        milestones: [{ number: 9, title: 'M1 · Giao diện và Identity' }],
      },
    ),
    {
      action: 'sync',
      type: 'Task',
      labels: ['backend', 'area:identity'],
      milestone: { number: 9, title: 'M1 · Giao diện và Identity' },
      fields: { priority: 'High', effort: 'Medium' },
    },
  );
});

test('không đồng bộ một phần khi thiếu metadata hoặc dùng giá trị ngoài danh mục', () => {
  const missing = planIssueSync(
    { type: { name: 'Task' }, labels: [], body: '### Khu vực\n\narea:unknown' },
    { areaLabels: ['area:identity'], milestones: [] },
  );
  assert.equal(missing.action, 'triage');
  assert.ok(missing.errors.includes('Milestone is required'));
  assert.ok(missing.errors.some((error) => error.includes('area:unknown')));

  const unsupported = planIssueSync(
    { type: { name: 'Task' }, labels: [], body: formBody.replace('High', 'P1') },
    {
      areaLabels: ['area:identity'],
      milestones: [{ number: 9, title: 'M1 · Giao diện và Identity' }],
    },
  );
  assert.equal(unsupported.action, 'triage');
  assert.ok(unsupported.errors.includes('Priority has unsupported value: P1'));

  const unknownMilestone = planIssueSync(
    { type: { name: 'Task' }, labels: [], body: formBody },
    { areaLabels: ['area:identity'], milestones: [] },
  );
  assert.equal(unknownMilestone.action, 'triage');
  assert.ok(
    unknownMilestone.errors.some((error) => error.startsWith('Milestone has unsupported value:')),
  );
});

test('Feature hợp lệ không tự thêm Effort', () => {
  const featureBody = formBody.replace(/### Effort\n+Medium/, '');
  assert.deepEqual(
    planIssueSync(
      { type: { name: 'Feature' }, labels: [], body: featureBody },
      {
        areaLabels: ['area:identity'],
        milestones: [{ number: 9, title: 'M1 · Giao diện và Identity' }],
      },
    ),
    {
      action: 'sync',
      type: 'Feature',
      labels: ['area:identity'],
      milestone: { number: 9, title: 'M1 · Giao diện và Identity' },
      fields: { priority: 'High' },
    },
  );
});

test('đồng bộ hợp lệ bỏ nhãn needs-triage, giữ nhãn khác và chỉ cập nhật field đổi', async () => {
  const calls = [];
  const plan = {
    action: 'sync',
    type: 'Task',
    labels: ['backend', 'area:identity'],
    milestone: { number: 9, title: 'M1 · Giao diện và Identity' },
    fields: { priority: 'High', effort: 'Medium' },
  };
  await applyIssueSyncPlan(
    {
      number: 15,
      node_id: 'I_15',
      type: { name: 'Bug' },
      labels: [{ name: 'backend' }, { name: 'needs-triage' }, { name: 'area:old' }],
      milestone: { number: 8 },
      fields: { Priority: 'Low', Effort: 'Medium' },
    },
    plan,
    {
      apiRequest: async (...args) => calls.push(['api', ...args]),
      setFields: async (...args) => calls.push(['fields', ...args]),
    },
  );
  assert.deepEqual(calls, [
    [
      'api',
      'PATCH',
      'repos/netverse3d/netverse3d/issues/15',
      { type: 'Task', milestone: 9, labels: ['backend', 'area:identity'] },
    ],
    ['fields', 'I_15', { priority: 'High' }],
  ]);
});

test('đồng bộ lặp lại không ghi lại metadata đã đúng', async () => {
  const calls = [];
  await applyIssueSyncPlan(
    {
      number: 15,
      type: { name: 'Task' },
      labels: [{ name: 'area:identity' }, { name: 'backend' }],
      milestone: { number: 9 },
      fields: { Priority: 'High', Effort: 'Medium' },
    },
    {
      action: 'sync',
      type: 'Task',
      labels: ['backend', 'area:identity'],
      milestone: { number: 9, title: 'M1 · Giao diện và Identity' },
      fields: { priority: 'High', effort: 'Medium' },
    },
    {
      apiRequest: async (...args) => calls.push(args),
      setFields: async (...args) => calls.push(args),
    },
  );
  assert.deepEqual(calls, []);
});

test('lỗi API khi gắn needs-triage làm đồng bộ thất bại', async () => {
  await assert.rejects(
    applyIssueSyncPlan(
      { number: 15, labels: [] },
      { action: 'triage', errors: ['Priority is required'] },
      {
        apiRequest: async () => {
          throw new Error('API failed');
        },
        setFields: async () => {},
      },
    ),
    /API failed/,
  );
});

test('issue thiếu metadata nhận needs-triage đúng một lần', async () => {
  const calls = [];
  const apiRequest = async (...args) => calls.push(args);
  const plan = { action: 'triage', errors: ['Priority is required'] };
  const issue = { number: 15, labels: [{ name: 'area:identity' }] };
  await applyIssueSyncPlan(issue, plan, { apiRequest, setFields: async () => {} });
  await applyIssueSyncPlan(
    { ...issue, labels: [...issue.labels, { name: 'needs-triage' }] },
    plan,
    { apiRequest, setFields: async () => {} },
  );
  assert.deepEqual(calls, [
    [
      'PATCH',
      'repos/netverse3d/netverse3d/issues/15',
      { labels: ['area:identity', 'needs-triage'] },
    ],
  ]);
});

test('issue Task phải có Effort', () => {
  assert.deepEqual(validateIssueMetadata(issue({ fields: { Priority: 'High' } })), [
    'Effort is required',
  ]);
});

test('Ready cần assignee, Start date và Target date', () => {
  assert.deepEqual(validateIssueMetadata(issue(), { ready: true }), [
    'Assignees are required before Ready',
    'Start date is required before Ready',
    'Target date is required before Ready',
  ]);
});

test('Ready hợp lệ khi người nhận và hai ngày đã có', () => {
  assert.deepEqual(
    validateIssueMetadata(
      issue({
        assignees: ['baodhg'],
        fields: {
          Priority: 'High',
          Effort: 'Medium',
          'Start date': '2026-11-15',
          'Target date': '2026-11-18',
        },
      }),
      { ready: true },
    ),
    [],
  );
});
