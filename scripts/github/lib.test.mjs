import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvironments, buildLabels, buildRulesets, findDrift } from './lib.mjs';

const settings = {
  approvals: 0,
  preventSelfReview: false,
  releaseAppId: null,
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

test('main chỉ nhận merge commit, staging nhận squash và merge ngược', () => {
  const rulesets = buildRulesets(settings);
  const methods = (name) =>
    rule(byName(rulesets, name), 'pull_request').parameters.allowed_merge_methods;
  assert.deepEqual(methods('main'), ['merge']);
  assert.deepEqual(methods('staging'), ['squash', 'merge']);
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
  assert.equal(byName(buildRulesets(settings), 'release-tags-created-by-app'), undefined);
});

test('có App thì chỉ App được tạo tag', () => {
  const ruleset = byName(
    buildRulesets({ ...settings, releaseAppId: 99 }),
    'release-tags-created-by-app',
  );
  assert.deepEqual(ruleset.rules, [{ type: 'creation' }]);
  assert.equal(ruleset.bypass_actors[0].actor_id, 99);
  assert.equal(ruleset.bypass_actors[0].actor_type, 'Integration');
});

test('môi trường duyệt production chỉ nhận nhánh main', () => {
  const release = buildEnvironments(settings).find((item) => item.name === 'production-release');
  assert.deepEqual(release.branchPolicy, [{ name: 'main', type: 'branch' }]);
  assert.deepEqual(release.reviewers, [{ type: 'User', id: 1 }]);
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
