import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PRE_PUSH = join(REPO_ROOT, '.githooks/pre-push');
const LINK = join(REPO_ROOT, 'scripts/drift/link.mjs');
const NO_COMMIT = '0'.repeat(40);
const REGISTRY = `requirements:
  - id: REQ-001
    title: Login
    status: accepted
    priority: must
    milestone: M1
    area: identity
    sources: [mentor-brief]
  - id: REQ-002
    title: Old
    status: deprecated
    priority: must
    milestone: M1
    area: identity
    sources: [mentor-brief]
`;

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function commit(cwd, file, message) {
  mkdirSync(dirname(join(cwd, file)), { recursive: true });
  writeFileSync(join(cwd, file), `${message}\n`);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-qm', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function createRepository() {
  const cwd = mkdtempSync(join(tmpdir(), 'drift-'));
  git(cwd, 'init', '-q', '-b', 'staging');
  git(cwd, 'config', 'user.name', 'Sim');
  git(cwd, 'config', 'user.email', 'sim@example.test');
  mkdirSync(join(cwd, 'docs/requirements'), { recursive: true });
  writeFileSync(join(cwd, 'docs/requirements/registry.yaml'), REGISTRY);
  const base = commit(cwd, 'README.md', 'chore: base');
  git(cwd, 'switch', '-qc', 'feat/1-login');
  return { cwd, base };
}

function answerFile(cwd, answer) {
  const file = join(cwd, '.git/answer.txt');
  writeFileSync(file, `${answer}\n`);
  return file.replaceAll('\\', '/');
}

function push(cwd, sha, base, drift) {
  const stdin = `refs/heads/feat/1-login ${sha} refs/heads/feat/1-login ${base}\n`;
  return spawnSync('sh', [PRE_PUSH.replaceAll('\\', '/')], {
    cwd,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, DRIFT_TTY: drift },
  });
}

test('hỏi và huỷ push khi đổi mã sản phẩm chưa gắn yêu cầu mà người dùng từ chối', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  const result = push(cwd, sha, base, answerFile(cwd, 'n'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Possible drift/);
  assert.match(result.stderr, /services\/identity\/src\/main\.ts/);
});

test('cho push khi người dùng xác nhận', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  assert.equal(push(cwd, sha, base, answerFile(cwd, 'y')).status, 0);
});

test('không có terminal thì cảnh báo và để kiểm tra PR chặn', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  const result = push(cwd, sha, base, join(cwd, 'no-such-tty').replaceAll('\\', '/'));
  assert.equal(result.status, 0);
  assert.match(result.stderr, /No terminal/);
});

test('không hỏi khi commit có trailer REQ đã chốt', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login\n\nRefs: REQ-001');
  const result = push(cwd, sha, base, answerFile(cwd, 'n'));
  assert.equal(result.status, 0, result.stderr);
});

test('không hỏi khi nhánh đã liên kết REQ đã chốt', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  const linked = spawnSync(process.execPath, [LINK, 'REQ-001'], { cwd, encoding: 'utf8' });
  assert.equal(linked.status, 0, linked.stderr);
  assert.equal(push(cwd, sha, base, answerFile(cwd, 'n')).status, 0);
});

test('vẫn hỏi khi dựa trên REQ đã bỏ', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login\n\nRefs: REQ-002');
  const result = push(cwd, sha, base, answerFile(cwd, 'n'));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /deprecated/);
});

test('không hỏi khi chỉ đổi tài liệu', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'docs/wiki/index.md', 'docs: add wiki');
  assert.equal(push(cwd, sha, base, answerFile(cwd, 'n')).status, 0);
});

test('nhánh mới vẫn được so với điểm tách khỏi staging', () => {
  const { cwd, base } = createRepository();
  git(cwd, 'update-ref', 'refs/remotes/origin/staging', base);
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  assert.equal(push(cwd, sha, NO_COMMIT, answerFile(cwd, 'n')).status, 1);
});

function pushWithLfs(cwd, sha, base, drift, lfsExitCode = 0) {
  const bin = join(cwd, '.git/fake-bin');
  const log = join(cwd, '.git/lfs.log');
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, 'git-lfs'),
    `#!/bin/sh\necho "$@" >> '${log.replaceAll('\\', '/')}'\ncat >> '${log.replaceAll('\\', '/')}'\nexit ${lfsExitCode}\n`,
    { mode: 0o755 },
  );
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH');
  const stdin = `refs/heads/feat/1-login ${sha} refs/heads/feat/1-login ${base}\n`;
  const result = spawnSync(
    'sh',
    [PRE_PUSH.replaceAll('\\', '/'), 'origin', 'https://example.test/repo.git'],
    {
      cwd,
      input: stdin,
      encoding: 'utf8',
      env: {
        ...process.env,
        DRIFT_TTY: drift,
        [pathKey]: `${bin}${delimiter}${process.env[pathKey]}`,
      },
    },
  );
  return { result, log };
}

test('đẩy tệp Git LFS sau khi qua kiểm tra truy vết', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'docs/wiki/index.md', 'docs: add wiki');
  const { result, log } = pushWithLfs(cwd, sha, base, answerFile(cwd, 'n'));
  assert.equal(result.status, 0, result.stderr);
  const recorded = readFileSync(log, 'utf8');
  assert.match(recorded, /pre-push origin https:\/\/example\.test\/repo\.git/);
  assert.match(recorded, new RegExp(sha));
});

test('không đẩy tệp Git LFS khi người dùng huỷ push', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'services/identity/src/main.ts', 'feat: add login');
  const { result, log } = pushWithLfs(cwd, sha, base, answerFile(cwd, 'n'));
  assert.equal(result.status, 1);
  assert.equal(existsSync(log), false);
});

test('chặn push khi đẩy tệp Git LFS thất bại', () => {
  const { cwd, base } = createRepository();
  const sha = commit(cwd, 'docs/wiki/index.md', 'docs: add wiki');
  const { result } = pushWithLfs(cwd, sha, base, answerFile(cwd, 'n'), 2);
  assert.equal(result.status, 2);
});

test('từ chối liên kết REQ không tồn tại', () => {
  const { cwd } = createRepository();
  const linked = spawnSync(process.execPath, [LINK, 'REQ-999'], { cwd, encoding: 'utf8' });
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /does not exist/);
});
