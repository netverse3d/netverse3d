import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateIssueMetadata } from './issue-quality.mjs';

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
