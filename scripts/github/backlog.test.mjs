import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { loadRegistry } from '../trace/lib.mjs';
import {
  findUnknownMilestones,
  issueFieldInputs,
  planBacklog,
  planBodyUpdates,
  planFieldUpdates,
  planMilestoneMoves,
  selectMissingIssues,
} from './backlog.mjs';

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
  assert.equal(issues[0].priority, 'High');
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

test('một việc có thể nằm ở milestone khác với yêu cầu của nó', () => {
  const seed = {
    tasks: [
      {
        requirement: 'REQ-001',
        items: [
          { title: 'Làm trước', size: 'M' },
          { title: 'Lùi lại', size: 'M', milestone: 'M2' },
        ],
      },
    ],
  };
  const { issues, errors } = planBacklog(requirements, seed, [
    ...milestones,
    { id: 'M2', title: 'M2 · Hai' },
  ]);
  assert.deepEqual(errors, []);
  assert.equal(issues.find((issue) => issue.title === 'Làm trước').milestone, 'M1 · Một');
  assert.equal(issues.find((issue) => issue.title === 'Lùi lại').milestone, 'M2 · Hai');
});

test('chạy lại không tạo trùng issue đã có', () => {
  const issues = [{ title: 'A' }, { title: 'B' }];
  assert.deepEqual(selectMissingIssues(issues, ['A']), [{ title: 'B' }]);
  assert.deepEqual(selectMissingIssues(issues, ['A', 'B']), []);
});

const plannedForMoves = [
  { key: 'REQ-008', type: 'Feature', title: 'REQ-008: Thông báo', milestone: 'M3 · Ba' },
  {
    key: 'REQ-008/Gửi email',
    parent: 'REQ-008',
    type: 'Task',
    title: 'Gửi email',
    milestone: 'M3 · Ba',
  },
];

function seeded(number, title, milestone, overrides = {}) {
  return {
    number,
    title,
    state: 'open',
    body: 'Yêu cầu: REQ-008\n\nThuộc: Thông báo',
    milestone: milestone ? { title: milestone } : null,
    ...overrides,
  };
}

test('dời issue đang mở sang milestone mới khi yêu cầu đổi mốc', () => {
  const existing = [
    seeded(5, 'REQ-008: Thông báo cũ', 'M2 · Hai'),
    seeded(6, 'Gửi email', 'M2 · Hai'),
  ];
  assert.deepEqual(planMilestoneMoves(plannedForMoves, existing), [
    { number: 5, from: 'M2 · Hai', to: 'M3 · Ba' },
    { number: 6, from: 'M2 · Hai', to: 'M3 · Ba' },
  ]);
});

test('không dời issue đã đóng hoặc đã đúng milestone', () => {
  const existing = [
    seeded(5, 'REQ-008: Thông báo', 'M2 · Hai', { state: 'closed' }),
    seeded(6, 'REQ-008: Thông báo', 'M3 · Ba'),
  ];
  assert.deepEqual(planMilestoneMoves(plannedForMoves, existing), []);
});

test('dời issue còn nằm ở milestone tên cũ khi GitHub có cả tên cũ lẫn tên mới', () => {
  const existing = [seeded(6, 'Gửi email', 'M3 · Tên cũ')];
  assert.deepEqual(planMilestoneMoves(plannedForMoves, existing), [
    { number: 6, from: 'M3 · Tên cũ', to: 'M3 · Ba' },
  ]);
});

test('không dời issue không có milestone', () => {
  assert.deepEqual(planMilestoneMoves(plannedForMoves, [seeded(5, 'Gửi email', null)]), []);
});

test('không dời issue tự tạo trùng tên việc hoặc mượn tiền tố yêu cầu', () => {
  const existing = [
    seeded(7, 'Gửi email', 'M2 · Hai', { body: 'Việc tự ghi' }),
    seeded(8, 'REQ-008: lỗi gửi thông báo', 'M2 · Hai', { body: null }),
  ];
  assert.deepEqual(planMilestoneMoves(plannedForMoves, existing), []);
});

test('báo milestone đích chưa có trên GitHub trước khi đụng tới issue', () => {
  assert.deepEqual(findUnknownMilestones(plannedForMoves, ['M2 · Hai']), ['M3 · Ba']);
  assert.deepEqual(findUnknownMilestones(plannedForMoves, ['M3 · Ba']), []);
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

test('tiêu đề milestone thật luôn bắt đầu bằng mã của nó', () => {
  const realMilestones = parse(
    readFileSync('docs/requirements/milestones.yaml', 'utf8'),
  ).milestones;
  for (const milestone of realMilestones) {
    assert.ok(milestone.title.startsWith(`${milestone.id} · `), milestone.title);
  }
});

const describedRequirement = {
  ...requirements[0],
  description: 'Người dùng tạo tài khoản và đăng nhập.',
};

function taskIssue(item) {
  const seed = { tasks: [{ requirement: 'REQ-001', items: [item] }] };
  const { issues } = planBacklog([describedRequirement], seed, milestones);
  return issues.find((issue) => issue.title === item.title);
}

test('issue con mang mô tả của yêu cầu, việc cần làm và mục xong khi nào', () => {
  const issue = taskIssue({
    title: 'Làm form',
    size: 'M',
    work: ['Dựng form đăng nhập'],
    done: ['Đăng nhập sai báo lỗi'],
  });
  assert.ok(issue.body.startsWith('Yêu cầu: REQ-001\n'));
  assert.ok(
    issue.body.includes(
      '## Bối cảnh\n\nThuộc: Đăng nhập\n\nNgười dùng tạo tài khoản và đăng nhập.',
    ),
  );
  assert.ok(issue.body.includes('## Việc cần làm\n\n- [ ] Dựng form đăng nhập'));
  assert.ok(issue.body.includes('## Xong khi nào\n\n- [ ] Đăng nhập sai báo lỗi'));
});

test('issue con chưa có chi tiết nhắc người nhận bổ sung trước khi sẵn sàng', () => {
  const issue = taskIssue({ title: 'Làm form', size: 'M' });
  assert.ok(issue.body.includes('## Việc cần làm\n\nNgười nhận bổ sung'));
  assert.ok(issue.body.includes('## Xong khi nào\n\nNgười nhận bổ sung'));
});

test('issue cha nêu mô tả yêu cầu và xong khi mọi issue con đã đóng', () => {
  const { issues } = planBacklog([describedRequirement], { tasks: [] }, milestones);
  assert.ok(issues[0].body.startsWith('Yêu cầu: REQ-001\n'));
  assert.ok(issues[0].body.includes('## Bối cảnh\n\nNgười dùng tạo tài khoản và đăng nhập.'));
  assert.ok(issues[0].body.includes('## Xong khi nào\n\n- [ ] Mọi issue con đã đóng'));
});

test('mức ưu tiên của yêu cầu đổi thành Priority và cỡ việc đổi thành Effort', () => {
  const should = { ...describedRequirement, priority: 'should' };
  const seed = {
    tasks: [
      {
        requirement: 'REQ-001',
        items: [
          { title: 'Nhỏ', size: 'S' },
          { title: 'Vừa', size: 'M' },
          { title: 'Lớn', size: 'L' },
        ],
      },
    ],
  };
  const { issues } = planBacklog([should], seed, milestones);
  assert.deepEqual(
    issues.map((issue) => [issue.title, issue.priority, issue.effort]),
    [
      ['REQ-001: Đăng nhập', 'Medium', undefined],
      ['Nhỏ', 'Medium', 'Low'],
      ['Vừa', 'Medium', 'Medium'],
      ['Lớn', 'Medium', 'High'],
    ],
  );
});

function existingIssue(number, title, body, state = 'open') {
  return { number, title, body, state };
}

test('chỉ viết lại thân issue còn ở dạng sinh tự động cũ', () => {
  const seed = {
    tasks: [
      {
        requirement: 'REQ-001',
        items: [
          { title: 'Thân cũ', size: 'S' },
          { title: 'Đã viết tay', size: 'S' },
          { title: 'Đã đóng', size: 'S' },
          { title: 'Đã mới', size: 'S' },
        ],
      },
    ],
  };
  const { issues } = planBacklog([describedRequirement], seed, milestones);
  const current = issues.find((issue) => issue.title === 'Đã mới').body;
  const updates = planBodyUpdates(issues, [
    existingIssue(1, 'Thân cũ', 'Yêu cầu: REQ-001\n\nThuộc: Đăng nhập'),
    existingIssue(2, 'Đã viết tay', 'Yêu cầu: REQ-001\n\nThuộc: Đăng nhập\n\n- Ghi chú riêng'),
    existingIssue(3, 'Đã đóng', 'Yêu cầu: REQ-001\n\nThuộc: Đăng nhập', 'closed'),
    existingIssue(4, 'Đã mới', current),
    existingIssue(
      5,
      'REQ-001: Đăng nhập',
      'Yêu cầu: REQ-001\n\nMô tả cũ\n\nTrạng thái yêu cầu: accepted\nNguồn: mentor-brief',
    ),
  ]);
  assert.deepEqual(
    updates.map((update) => update.number),
    [1, 5],
  );
  assert.ok(updates[0].body.includes('## Xong khi nào'));
});

test('issue mở sinh từ sổ yêu cầu nhận Priority và Effort, issue tự tạo không bị đụng', () => {
  const seed = { tasks: [{ requirement: 'REQ-001', items: [{ title: 'Làm form', size: 'L' }] }] };
  const { issues } = planBacklog([describedRequirement], seed, milestones);
  const updates = planFieldUpdates(issues, [
    existingIssue(1, 'Làm form', 'Yêu cầu: REQ-001\n\nThuộc: Đăng nhập'),
    existingIssue(2, 'Việc tự tạo', 'Yêu cầu: REQ-001\n\nThuộc: Đăng nhập'),
    existingIssue(3, 'REQ-001: Đăng nhập', 'Yêu cầu: REQ-001\n\nMô tả', 'closed'),
  ]);
  assert.deepEqual(updates, [{ number: 1, priority: 'High', effort: 'High' }]);
});

const issueFields = [
  {
    id: 'F1',
    name: 'Priority',
    options: [
      { id: 'O1', name: 'High' },
      { id: 'O2', name: 'Low' },
    ],
  },
  { id: 'F2', name: 'Effort', options: [{ id: 'O3', name: 'Medium' }] },
  { id: 'F3', name: 'Start date' },
];

test('giá trị Priority và Effort đổi thành đúng mã lựa chọn của field trên issue', () => {
  assert.deepEqual(issueFieldInputs(issueFields, { priority: 'High', effort: 'Medium' }), [
    { fieldId: 'F1', singleSelectOptionId: 'O1' },
    { fieldId: 'F2', singleSelectOptionId: 'O3' },
  ]);
  assert.deepEqual(issueFieldInputs(issueFields, { priority: 'Low' }), [
    { fieldId: 'F1', singleSelectOptionId: 'O2' },
  ]);
});

test('giá trị không có trong field bị từ chối thay vì bỏ qua', () => {
  assert.throws(() => issueFieldInputs(issueFields, { priority: 'P1' }), /Priority.*P1/);
  assert.throws(() => issueFieldInputs([], { effort: 'Low' }), /Effort/);
});
