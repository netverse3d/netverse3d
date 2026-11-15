import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import {
  evaluateBranchFlow,
  evaluatePullRequest,
  extractClosingIssueNumbers,
  extractReferences,
  isProductPath,
  isTraceExempt,
  loadDecisions,
  validateDecisions,
  validateRegistry,
} from './lib.mjs';

const accepted = {
  id: 'REQ-001',
  title: 'Đăng nhập',
  status: 'accepted',
  priority: 'must',
  milestone: 'M1',
  area: 'identity',
  sources: ['mentor-brief'],
};
const requirements = [
  accepted,
  { ...accepted, id: 'REQ-002', status: 'draft' },
  { ...accepted, id: 'REQ-003', status: 'deprecated' },
];
const decisions = [
  { id: 'ADR-0001', status: 'accepted' },
  { id: 'ADR-0002', status: 'superseded' },
];

function completeIssue(number = 12, overrides = {}) {
  return {
    number,
    type: 'Task',
    labels: ['area:identity'],
    milestone: 'M1',
    fields: {
      Priority: 'High',
      Effort: 'Medium',
      'Start date': '2026-11-15',
      'Target date': '2026-11-18',
    },
    assignees: ['developer'],
    ...overrides,
  };
}

function review(body, files = ['services/identity/src/main.ts']) {
  const closingIssues = extractClosingIssueNumbers(body).map((number) => completeIssue(number));
  return evaluatePullRequest({
    body,
    files,
    requirements,
    decisions,
    closingIssues,
    allowedAreaLabels: ['area:identity'],
    allowedMilestones: ['M1'],
  });
}

test('chặn PR đổi mã sản phẩm mà không có REQ hoặc ADR', () => {
  const { errors } = review('Closes #12');
  assert.match(errors.join(), /without a REQ or ADR/);
});

test('chặn PR đổi mã sản phẩm mà không gắn issue', () => {
  const { errors } = review('REQ-001');
  assert.match(errors.join(), /must close an issue/);
});

test('chặn PR nhắc REQ không tồn tại', () => {
  const { errors } = review('Closes #12 REQ-999');
  assert.match(errors.join(), /REQ-999 does not exist/);
});

test('chặn PR dựa trên REQ đã bỏ', () => {
  const { errors } = review('Closes #12 REQ-003');
  assert.match(errors.join(), /deprecated/);
});

test('chặn PR dựa trên ADR đã bị thay thế', () => {
  const { errors } = review('Closes #12 ADR-0002');
  assert.match(errors.join(), /superseded/);
});

test('cảnh báo nhưng không chặn khi REQ còn draft', () => {
  const { errors, warnings } = review('Closes #12 REQ-002');
  assert.deepEqual(errors, []);
  assert.match(warnings.join(), /draft/);
});

test('nhận PR có REQ đã chốt và issue', () => {
  const { errors, warnings } = review('Closes #12\n\nREQ-001');
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('nhận PR có ADR đã chốt và issue', () => {
  assert.deepEqual(review('Closes #12, ADR-0001').errors, []);
});

test('lấy đủ số issue cần đóng, không lặp số và nhận biến thể từ khóa GitHub', () => {
  assert.deepEqual(extractClosingIssueNumbers('Closes #12, fixes #13; resolves #12'), [12, 13]);
});

test('workflow PR có quyền đọc issue và truyền token cho bộ kiểm metadata', () => {
  const workflow = parse(readFileSync('.github/workflows/pr-trace.yml', 'utf8'));
  assert.equal(workflow.permissions.issues, 'read');
  const traceStep = workflow.jobs.trace.steps.find((step) =>
    step.run?.includes('scripts/trace/check-pr.mjs'),
  );
  assert.equal(traceStep.env.GH_TOKEN, '${{ github.token }}');
});

test('chặn PR đóng issue thiếu area, milestone, Priority và Effort', () => {
  const { errors } = evaluatePullRequest({
    body: 'Closes #12',
    files: [],
    requirements,
    decisions,
    closingIssues: [{ number: 12, type: 'Task', labels: [], fields: {}, assignees: [] }],
  });
  assert.match(errors.join('\n'), /#12.*area/);
  assert.match(errors.join('\n'), /#12.*Milestone/);
  assert.match(errors.join('\n'), /#12.*Priority/);
  assert.match(errors.join('\n'), /#12.*Effort/);
});

test('issue đóng qua PR cần assignee và Start date cùng Target date', () => {
  const { errors } = evaluatePullRequest({
    body: 'Closes #12',
    files: [],
    requirements,
    decisions,
    closingIssues: [
      {
        number: 12,
        type: 'Task',
        labels: ['area:identity'],
        milestone: 'M1',
        fields: { Priority: 'High', Effort: 'Medium' },
        assignees: [],
      },
    ],
  });
  assert.match(errors.join('\n'), /#12.*Assignees/);
  assert.match(errors.join('\n'), /#12.*Start date/);
  assert.match(errors.join('\n'), /#12.*Target date/);
});

test('chặn PR nếu không tải được metadata của issue cần đóng', () => {
  const { errors } = evaluatePullRequest({
    body: 'Closes #12',
    files: [],
    requirements,
    decisions,
  });
  assert.match(errors.join('\n'), /#12: issue metadata could not be loaded/);
});

test('nhận issue đủ metadata và chặn needs-triage', () => {
  const complete = completeIssue(12, {
    type: { name: 'Task' },
    labels: [{ name: 'area:identity' }],
    milestone: { title: 'M1' },
    assignees: [{ login: 'developer' }],
  });
  const acceptedResult = evaluatePullRequest({
    body: 'Closes #12',
    files: [],
    requirements,
    decisions,
    closingIssues: [complete],
    allowedAreaLabels: ['area:identity'],
    allowedMilestones: ['M1'],
  });
  assert.deepEqual(acceptedResult.errors, []);

  const triageResult = evaluatePullRequest({
    body: 'Closes #12',
    files: [],
    requirements,
    decisions,
    closingIssues: [{ ...complete, labels: [...complete.labels, { name: 'needs-triage' }] }],
  });
  assert.match(triageResult.errors.join('\n'), /#12.*needs-triage/);
});

test('miễn REQ cho PR chỉ đổi tài liệu hoặc công cụ', () => {
  const { errors } = review('Closes #12', [
    'docs/wiki/index.md',
    'scripts/format.mjs',
    '.github/x.yml',
  ]);
  assert.deepEqual(errors, []);
});

test('miễn REQ cho README và component.yaml trong thư mục sản phẩm', () => {
  const { errors } = review('Closes #12', [
    'services/identity/README.md',
    'apps/admin/component.yaml',
  ]);
  assert.deepEqual(errors, []);
});

test('coi hạ tầng là mã sản phẩm', () => {
  assert.equal(isProductPath('infra/compose/compose.yaml'), true);
});

test('vẫn kiểm REQ được nhắc tới trong PR chỉ đổi tài liệu', () => {
  const { errors } = review('REQ-999', ['docs/wiki/index.md']);
  assert.match(errors.join(), /REQ-999/);
});

test('không trùng lặp mã tham chiếu', () => {
  assert.deepEqual(extractReferences('REQ-001 và REQ-001, ADR-0001'), ['REQ-001', 'ADR-0001']);
});

test('main chỉ nhận PR từ staging', () => {
  assert.equal(evaluateBranchFlow({ base: 'main', head: 'feat/12-login' }).length, 1);
  assert.equal(evaluateBranchFlow({ base: 'main', head: 'fix/13-payment' }).length, 1);
  assert.deepEqual(evaluateBranchFlow({ base: 'main', head: 'staging' }), []);
});

test('staging nhận nhánh việc, không nhận PR từ main', () => {
  assert.deepEqual(evaluateBranchFlow({ base: 'staging', head: 'feat/12-login' }), []);
  assert.deepEqual(evaluateBranchFlow({ base: 'staging', head: 'fix/13-payment' }), []);
  assert.equal(evaluateBranchFlow({ base: 'staging', head: 'main' }).length, 1);
});

test('PR từ fork không được giả nhánh staging để vào main', () => {
  assert.equal(evaluateBranchFlow({ base: 'main', head: 'staging', isFork: true }).length, 1);
});

test('đưa staging lên main không cần gắn lại yêu cầu', () => {
  assert.equal(isTraceExempt({ base: 'main', head: 'staging' }), true);
  assert.equal(isTraceExempt({ base: 'staging', head: 'main' }), false);
  const { errors } = evaluatePullRequest({
    body: '',
    files: ['services/identity/src/main.ts'],
    requirements,
    decisions,
    exempt: true,
  });
  assert.deepEqual(errors, []);
});

test('PR cập nhật thư viện phải gắn yêu cầu như mọi PR khác, kể cả do bot tạo', () => {
  const pullRequest = { base: 'staging', head: 'dependabot/npm_and_yarn/all' };
  assert.equal(isTraceExempt({ ...pullRequest, author: 'dependabot[bot]' }), false);
  assert.equal(isTraceExempt({ base: 'staging', head: 'chore/bump-next' }), false);
});

test('cảnh báo khi PR tự thêm ADR rồi tự trích dẫn', () => {
  const { warnings } = evaluatePullRequest({
    body: 'Closes #12 ADR-0001',
    files: ['services/identity/src/main.ts'],
    requirements,
    decisions,
    closingIssues: [completeIssue()],
    baseDecisionIds: ['ADR-0002'],
  });
  assert.match(warnings.join(), /ADR-0001 was added by this pull request/);
});

test('nhánh việc thường và nhánh từ fork vẫn phải gắn yêu cầu', () => {
  assert.equal(isTraceExempt({ base: 'staging', head: 'feat/12-login' }), false);
  assert.equal(isTraceExempt({ base: 'main', head: 'staging', isFork: true }), false);
  assert.equal(isTraceExempt({ base: 'staging', head: 'dependabot/x', isFork: true }), false);
});

test('cảnh báo khi PR tự thêm yêu cầu rồi tự trích dẫn', () => {
  const { errors, warnings } = evaluatePullRequest({
    body: 'Closes #12 REQ-001',
    files: ['services/identity/src/main.ts'],
    requirements,
    decisions,
    closingIssues: [completeIssue()],
    baseRequirementIds: ['REQ-002'],
  });
  assert.deepEqual(errors, []);
  assert.match(warnings.join(), /REQ-001 was added by this pull request/);
});

test('không cảnh báo khi yêu cầu đã có từ trước', () => {
  const { warnings } = evaluatePullRequest({
    body: 'Closes #12 REQ-001',
    files: ['services/identity/src/main.ts'],
    requirements,
    decisions,
    closingIssues: [completeIssue()],
    baseRequirementIds: ['REQ-001'],
  });
  assert.deepEqual(warnings, []);
});

test('cảnh báo khi dựa trên ADR mới ở mức đề xuất', () => {
  const { warnings } = evaluatePullRequest({
    body: 'Closes #12 ADR-0003',
    files: ['services/identity/src/main.ts'],
    requirements,
    decisions: [...decisions, { id: 'ADR-0003', status: 'proposed' }],
    closingIssues: [completeIssue()],
  });
  assert.match(warnings.join(), /ADR-0003 is still proposed/);
});

test('sổ yêu cầu báo id sai, trùng và thiếu trường', () => {
  const errors = validateRegistry([
    accepted,
    { ...accepted },
    { id: 'R1', title: '', status: 'x', priority: 'y', sources: [] },
  ]);
  const text = errors.join('\n');
  assert.match(text, /REQ-001: duplicate id/);
  assert.match(text, /R1: invalid id/);
  assert.match(text, /R1: missing title/);
  assert.match(text, /R1: invalid status/);
  assert.match(text, /R1: invalid priority/);
  assert.match(text, /R1: missing milestone/);
  assert.match(text, /R1: missing area/);
  assert.match(text, /R1: missing sources/);
});

test('sổ yêu cầu hợp lệ không có lỗi', () => {
  assert.deepEqual(validateRegistry(requirements), []);
});

test('đọc trạng thái ADR từ tệp và báo tệp thiếu trạng thái', () => {
  const root = mkdtempSync(join(tmpdir(), 'trace-'));
  mkdirSync(join(root, 'docs/decisions'), { recursive: true });
  writeFileSync(join(root, 'docs/decisions/ADR-0001-a.md'), '# A\n\n- Trạng thái: accepted\n');
  writeFileSync(join(root, 'docs/decisions/ADR-0002-b.md'), '# B\n');
  const loaded = loadDecisions(root);
  assert.equal(loaded[0].status, 'accepted');
  assert.match(validateDecisions(loaded).join(), /ADR-0002/);
});

test('chặn PR chỉ đổi tài liệu hoặc công cụ mà không đóng issue nào', () => {
  const { errors } = review('Cập nhật wiki', ['docs/wiki/index.md']);
  assert.match(errors.join(), /must close an issue/);
});

test('nhắc tới issue bằng Refs không thay được cho Closes', () => {
  const { errors } = review('REQ-001, Refs #12');
  assert.match(errors.join(), /must close an issue/);
});

test('nhận các từ khoá đóng issue của GitHub', () => {
  for (const keyword of ['Closes', 'closes', 'Fixes', 'Resolves']) {
    assert.deepEqual(review(`REQ-001, ${keyword} #12`).errors, []);
  }
});

test('PR phát hành và Dependabot không cần đóng issue', () => {
  const { errors } = evaluatePullRequest({
    body: '',
    files: ['docs/wiki/index.md'],
    requirements,
    decisions,
    exempt: true,
  });
  assert.deepEqual(errors, []);
});
