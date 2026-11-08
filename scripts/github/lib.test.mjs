import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEnvironments,
  buildLabels,
  buildRulesets,
  findDrift,
  findEnvironmentDrift,
  planMilestones,
} from './lib.mjs';

const settings = {
  approvals: 0,
  preventSelfReview: false,
  releaseAppIds: { staging: null, production: null },
  requiredChecks: ['verify', 'trace', 'secrets'],
  resolvedReviewers: [{ type: 'User', id: 1 }],
};

function rule(ruleset, type) {
  return ruleset.rules.find((item) => item.type === type);
}

function byName(rulesets, name) {
  return rulesets.find((item) => item.name === name);
}

test('không ai được bỏ qua ruleset của nhánh, kể cả admin', () => {
  const rulesets = buildRulesets(settings);
  assert.deepEqual(byName(rulesets, 'staging').bypass_actors, []);
  assert.deepEqual(byName(rulesets, 'main').bypass_actors, []);
});

test('main chỉ nhận merge commit, staging chỉ nhận squash', () => {
  const rulesets = buildRulesets(settings);
  const methods = (name) =>
    rule(byName(rulesets, name), 'pull_request').parameters.allowed_merge_methods;
  assert.deepEqual(methods('main'), ['merge']);
  assert.deepEqual(methods('staging'), ['squash']);
});

test('nhánh yêu cầu đủ các check bắt buộc', () => {
  const contexts = rule(
    byName(buildRulesets(settings), 'main'),
    'required_status_checks',
  ).parameters.required_status_checks.map((item) => item.context);
  assert.deepEqual(contexts, ['verify', 'trace', 'secrets']);
});

test('không bắt buộc đúng code owner duyệt để không phụ thuộc người cụ thể', () => {
  const parameters = rule(byName(buildRulesets(settings), 'main'), 'pull_request').parameters;
  assert.equal(parameters.require_code_owner_review, false);
});

test('có thành viên thì yêu cầu một người duyệt và duyệt lại khi có commit mới', () => {
  const parameters = rule(
    byName(buildRulesets({ ...settings, approvals: 1 }), 'staging'),
    'pull_request',
  ).parameters;
  assert.equal(parameters.required_approving_review_count, 1);
  assert.equal(parameters.require_last_push_approval, true);
  assert.equal(parameters.dismiss_stale_reviews_on_push, true);
});

test('không ai sửa hoặc xoá được tag phát hành', () => {
  const immutable = byName(buildRulesets(settings), 'release-tags-immutable');
  assert.deepEqual(immutable.bypass_actors, []);
  assert.deepEqual(
    immutable.rules.map((item) => item.type),
    ['update', 'deletion', 'non_fast_forward'],
  );
});

test('chưa có App thì chưa chặn tạo tag', () => {
  const names = buildRulesets(settings).map((item) => item.name);
  assert.ok(!names.includes('release-tags-staging-by-app'));
  assert.ok(!names.includes('release-tags-production-by-app'));
});

test('mỗi App chỉ được tạo tag của đúng môi trường', () => {
  const rulesets = buildRulesets({
    ...settings,
    releaseAppIds: { staging: 11, production: 22 },
  });
  const staging = byName(rulesets, 'release-tags-staging-by-app');
  const production = byName(rulesets, 'release-tags-production-by-app');
  assert.deepEqual(staging.conditions.ref_name.include, ['refs/tags/stg-v*']);
  assert.equal(staging.bypass_actors[0].actor_id, 11);
  assert.equal(staging.bypass_actors[0].actor_type, 'Integration');
  assert.deepEqual(staging.rules, [{ type: 'creation' }]);
  assert.deepEqual(production.conditions.ref_name.include, ['refs/tags/prod-v*']);
  assert.equal(production.bypass_actors[0].actor_id, 22);
  assert.equal(production.bypass_actors.length, 1);
});

test('check bắt buộc phải do GitHub Actions tạo, không giả được bằng status', () => {
  const checks = rule(byName(buildRulesets(settings), 'staging'), 'required_status_checks')
    .parameters.required_status_checks;
  for (const check of checks) assert.equal(check.integration_id, 15368, check.context);
});

test('môi trường duyệt production chỉ nhận nhánh main', () => {
  const release = buildEnvironments(settings).find((item) => item.name === 'production-release');
  assert.deepEqual(release.branchPolicy, [{ name: 'main', type: 'branch' }]);
  assert.deepEqual(release.reviewers, [{ type: 'User', id: 1 }]);
});

test('môi trường tạo tag staging chỉ nhận nhánh staging', () => {
  const release = buildEnvironments(settings).find((item) => item.name === 'release-staging');
  assert.deepEqual(
    release.branchPolicy.map((item) => item.name),
    ['staging'],
  );
});

test('không môi trường nào cho admin bỏ qua quy tắc', () => {
  for (const environment of buildEnvironments(settings)) {
    assert.equal(environment.canAdminsBypass, false, environment.name);
  }
});

const environment = {
  name: 'production-release',
  branchPolicy: [{ name: 'main', type: 'branch' }],
  reviewers: [{ type: 'User', id: 1 }],
  preventSelfReview: false,
  canAdminsBypass: false,
};
const healthy = {
  can_admins_bypass: false,
  protection_rules: [
    {
      type: 'required_reviewers',
      prevent_self_review: false,
      reviewers: [{ type: 'User', reviewer: { id: 1 } }],
    },
  ],
};
const mainPolicy = [{ name: 'main', type: 'branch' }];

test('môi trường đúng cấu hình thì không có khác biệt', () => {
  assert.deepEqual(findEnvironmentDrift(environment, healthy, mainPolicy), []);
});

test('phát hiện môi trường cho admin bỏ qua', () => {
  const drift = findEnvironmentDrift(
    environment,
    { ...healthy, can_admins_bypass: true },
    mainPolicy,
  );
  assert.match(drift.join(), /can_admins_bypass/);
});

test('phát hiện policy nhánh thừa, thiếu hoặc sai loại', () => {
  const extra = findEnvironmentDrift(environment, healthy, [
    ...mainPolicy,
    { name: '*', type: 'branch' },
  ]);
  assert.match(extra.join(), /unexpected policy branch:\*/);
  const wrongType = findEnvironmentDrift(environment, healthy, [{ name: 'main', type: 'tag' }]);
  assert.match(wrongType.join(), /missing policy branch:main/);
});

test('phát hiện người duyệt thừa hoặc thiếu', () => {
  const noReviewer = findEnvironmentDrift(
    environment,
    { ...healthy, protection_rules: [] },
    mainPolicy,
  );
  assert.match(noReviewer.join(), /missing reviewer User:1/);
  const extra = findEnvironmentDrift({ ...environment, reviewers: [] }, healthy, mainPolicy);
  assert.match(extra.join(), /unexpected reviewer User:1/);
});

test('phát hiện chưa bật cấm tự duyệt', () => {
  const drift = findEnvironmentDrift(
    { ...environment, preventSelfReview: true },
    healthy,
    mainPolicy,
  );
  assert.match(drift.join(), /prevent_self_review/);
});

test('có nhãn cho từng thành phần và nhãn quy trình', () => {
  const names = buildLabels([{ id: 'identity' }]).map((item) => item.name);
  assert.ok(names.includes('area:identity'));
  assert.ok(names.includes('area:infra'));
  assert.ok(names.includes('needs-decision'));
  assert.ok(names.includes('waiting-mentor'));
});

test('phát hiện khác biệt giữa cấu hình mong muốn và thực tế', () => {
  const drift = findDrift(
    { a: 1, b: { c: true }, d: [{ e: 1 }] },
    { a: 2, b: { c: true, extra: 1 }, d: [{ e: 2 }] },
  );
  assert.deepEqual(drift, ['a: expected 1, got 2', 'd[0].e: expected 1, got 2']);
});

test('phát hiện mảng thiếu phần tử', () => {
  assert.match(findDrift({ a: [1, 2] }, { a: [1] }).join(), /expected 2 items, got 1/);
});

test('cấu hình khớp thì không có khác biệt', () => {
  assert.deepEqual(findDrift({ a: { b: [1] } }, { a: { b: [1], c: 2 }, d: 3 }), []);
});

test('đổi tên milestone theo mã thay vì tạo milestone trùng', () => {
  const desired = [
    { id: 'M2', title: 'M2 · Lát cắt đầu', goal: 'Mới' },
    { id: 'M3', title: 'M3 · Xèng', goal: 'Ba' },
    { id: 'M9', title: 'M9 · Thêm', goal: 'Chín' },
  ];
  const existing = [
    { number: 3, title: 'M2 · Media và Notification', description: 'Cũ' },
    { number: 4, title: 'M3 · Xèng', description: 'Ba' },
  ];
  assert.deepEqual(planMilestones(desired, existing), [
    { action: 'update', number: 3, body: { title: 'M2 · Lát cắt đầu', description: 'Mới' } },
    { action: 'create', body: { title: 'M9 · Thêm', description: 'Chín' } },
  ]);
});

test('không nhầm M1 với M10 khi so mã milestone', () => {
  const desired = [{ id: 'M1', title: 'M1 · Một', goal: 'A' }];
  const existing = [{ number: 9, title: 'M10 · Mười', description: 'B' }];
  assert.deepEqual(planMilestones(desired, existing), [
    { action: 'create', body: { title: 'M1 · Một', description: 'A' } },
  ]);
});

test('ưu tiên milestone trùng tên khi GitHub có cả tên cũ lẫn tên mới', () => {
  const desired = [{ id: 'M2', title: 'M2 · Mới', goal: 'A' }];
  const existing = [
    { number: 3, title: 'M2 · Cũ', description: 'B' },
    { number: 8, title: 'M2 · Mới', description: 'A' },
  ];
  assert.deepEqual(planMilestones(desired, existing), []);
});

test('chỉ cập nhật mô tả khi tên milestone giữ nguyên', () => {
  const desired = [{ id: 'M2', title: 'M2 · Hai', goal: 'Mới' }];
  const existing = [{ number: 3, title: 'M2 · Hai', description: 'Cũ' }];
  assert.deepEqual(planMilestones(desired, existing), [
    { action: 'update', number: 3, body: { title: 'M2 · Hai', description: 'Mới' } },
  ]);
});
