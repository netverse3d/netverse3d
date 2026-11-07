import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), 'agent-hook.mjs');
const REGISTRY = `requirements:
  - id: REQ-001
    title: Login
    status: accepted
    priority: must
    milestone: M1
    area: identity
    sources: [mentor-brief]
`;

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-hook-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'staging');
  git('config', 'user.name', 'Sim');
  git('config', 'user.email', 'sim@example.test');
  mkdirSync(join(cwd, 'docs/requirements'), { recursive: true });
  writeFileSync(join(cwd, 'docs/requirements/registry.yaml'), REGISTRY);
  git('add', '-A');
  git('commit', '-qm', 'chore: base');
  git('update-ref', 'refs/remotes/origin/staging', 'HEAD');
  git('switch', '-qc', 'feat/1-login');
  return { cwd, git };
}

function runHook(cwd, file) {
  const input = JSON.stringify({ cwd, tool_name: 'Write', tool_input: { file_path: file } });
  return spawnSync(process.execPath, [HOOK], { cwd, input, encoding: 'utf8' });
}

test('yêu cầu hỏi người dùng khi sửa mã sản phẩm chưa gắn yêu cầu', () => {
  const { cwd } = createRepository();
  const result = runHook(cwd, join(cwd, 'services/identity/src/main.ts'));
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.permissionDecision, 'ask');
  assert.match(output.permissionDecisionReason, /services\/identity\/src\/main\.ts/);
});

test('không hỏi khi nhánh đã liên kết yêu cầu đã chốt', () => {
  const { cwd, git } = createRepository();
  git('config', '--add', 'branch.feat/1-login.trace', 'REQ-001');
  const result = runHook(cwd, join(cwd, 'services/identity/src/main.ts'));
  assert.equal(result.stdout, '');
});

test('không hỏi khi commit trên nhánh đã có trailer yêu cầu', () => {
  const { cwd, git } = createRepository();
  git('commit', '--allow-empty', '-qm', 'feat: add login\n\nRefs: REQ-001');
  const result = runHook(cwd, join(cwd, 'services/identity/src/main.ts'));
  assert.equal(result.stdout, '');
});

test('hỏi khi yêu cầu được liên kết không còn tồn tại', () => {
  const { cwd, git } = createRepository();
  git('config', '--add', 'branch.feat/1-login.trace', 'REQ-999');
  const result = runHook(cwd, join(cwd, 'apps/admin/src/page.tsx'));
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.permissionDecisionReason, /REQ-999/);
});

test('không hỏi khi sửa tài liệu hoặc README của service', () => {
  const { cwd } = createRepository();
  assert.equal(runHook(cwd, join(cwd, 'docs/wiki/index.md')).stdout, '');
  assert.equal(runHook(cwd, join(cwd, 'services/identity/README.md')).stdout, '');
});

test('không hỏi với tệp nằm ngoài repo', () => {
  const { cwd } = createRepository();
  assert.equal(runHook(cwd, join(tmpdir(), 'outside.ts')).stdout, '');
});

test('đầu vào hỏng không làm kẹt công cụ nhưng có báo lỗi', () => {
  const { cwd } = createRepository();
  const result = spawnSync(process.execPath, [HOOK], { cwd, input: 'not json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /Drift check skipped/);
});
