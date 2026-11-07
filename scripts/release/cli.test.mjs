import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VALIDATE = resolve(HERE, 'validate.mjs');
const PLAN = resolve(HERE, 'plan-images.mjs');
const CATALOG = `components:
  - id: identity
    path: services/identity
    kind: service
    stack: NestJS
    summary: Auth
    milestone: M1
`;

function createRepository() {
  const remote = mkdtempSync(join(tmpdir(), 'release-remote-'));
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main'], { cwd: remote });
  const cwd = mkdtempSync(join(tmpdir(), 'release-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Sim');
  git('config', 'user.email', 'sim@example.test');
  git('config', 'core.autocrlf', 'false');
  git('remote', 'add', 'origin', remote);
  const change = (file, message) => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), `${message}\n`);
    git('add', '-A');
    git('commit', '-qm', message);
  };
  writeFileSync(join(cwd, 'seed.txt'), 'seed\n');
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs/catalog.yaml'), CATALOG);
  mkdirSync(join(cwd, 'services/identity'), { recursive: true });
  writeFileSync(join(cwd, 'services/identity/Dockerfile'), 'FROM scratch\n');
  git('add', '-A');
  git('commit', '-qm', 'chore: base');
  git('switch', '-qc', 'staging');
  change('docs/feature.txt', 'feat: add feature');
  const pushAll = () => git('push', '-q', 'origin', 'main', 'staging', '--tags', '--force');
  return { cwd, git, change, pushAll };
}

function validate(cwd, environment, version, branch) {
  return spawnSync(
    process.execPath,
    [VALIDATE, '--environment', environment, '--version', version, '--branch', branch],
    { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } },
  );
}

function plan(cwd, tag) {
  return spawnSync(process.execPath, [PLAN, tag], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: '' },
  });
}

test('chạy trọn vòng staging rồi production với cùng nội dung', () => {
  const { cwd, git } = createRepository();
  assert.equal(validate(cwd, 'staging', '0.1.0', 'staging').status, 0);
  git('tag', 'stg-v0.1.0');
  git('switch', '-q', 'main');
  git('merge', '-q', '--no-ff', '--no-edit', 'staging');
  const result = validate(cwd, 'production', '0.1.0', 'main');
  assert.equal(result.status, 0, result.stderr);
});

test('từ chối production khi main có thay đổi chưa test', () => {
  const { cwd, git, change } = createRepository();
  git('tag', 'stg-v0.1.0');
  git('switch', '-q', 'main');
  git('merge', '-q', '--no-ff', '--no-edit', 'staging');
  change('docs/untested.txt', 'fix: change not tested');
  const result = validate(cwd, 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content differs/);
});

test('từ chối production khi chưa phát hành staging', () => {
  const { cwd, git } = createRepository();
  git('switch', '-q', 'main');
  const result = validate(cwd, 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not exist/);
});

test('từ chối phát hành lại số đã có', () => {
  const { cwd, git } = createRepository();
  git('tag', 'stg-v0.1.0');
  const result = validate(cwd, 'staging', '0.1.0', 'staging');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
});

test('production dùng image của bản staging nơi service đổi lần cuối', () => {
  const { cwd, git, change, pushAll } = createRepository();
  git('tag', 'stg-v0.1.0');
  change('services/identity/src/a.txt', 'feat: change identity');
  git('tag', 'stg-v0.1.1');
  change('docs/note.txt', 'docs: add note');
  git('tag', 'stg-v0.1.2');
  git('switch', '-q', 'main');
  git('merge', '-q', '--no-ff', '--no-edit', 'staging');
  git('tag', 'prod-v0.1.2');
  pushAll();
  git('fetch', '-q', 'origin');
  const result = plan(cwd, 'prod-v0.1.2');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"sourceTag":"stg-v0\.1\.1"/);
});

test('sửa lỗi đi qua staging nhiều vòng mà không cần merge ngược', () => {
  const { cwd, git, change } = createRepository();
  const checks = join(cwd, '.git/checks.json');
  writeFileSync(
    checks,
    JSON.stringify([
      { name: 'verify', conclusion: 'success', app: { slug: 'github-actions' } },
      { name: 'secrets', conclusion: 'success', app: { slug: 'github-actions' } },
    ]),
  );
  const release = (environment, version, branch) =>
    spawnSync(
      process.execPath,
      [
        VALIDATE,
        '--environment',
        environment,
        '--version',
        version,
        '--branch',
        branch,
        '--checks-file',
        checks,
      ],
      { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '' } },
    );
  for (const [version, file] of [
    ['0.1.0', 'docs/first.txt'],
    ['0.1.1', 'docs/second.txt'],
    ['0.1.2', 'docs/third.txt'],
  ]) {
    git('switch', '-q', 'staging');
    change(file, 'fix: urgent repair');
    const staged = release('staging', version, 'staging');
    assert.equal(staged.status, 0, staged.stderr);
    git('tag', `stg-v${version}`);
    git('switch', '-q', 'main');
    git('merge', '-q', '--no-ff', '--no-edit', 'staging');
    const released = release('production', version, 'main');
    assert.equal(released.status, 0, released.stderr);
    git('tag', `prod-v${version}`);
  }
});

test('tag sai định dạng không được lập kế hoạch build', () => {
  const { cwd } = createRepository();
  const result = plan(cwd, 'v1.0.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a valid release tag/);
});

test('tag staging đặt ngoài nhánh cho phép bị từ chối', () => {
  const { cwd, git, pushAll } = createRepository();
  git('switch', '-qc', 'feat/x');
  git('tag', 'stg-v0.1.0');
  git('switch', '-q', 'staging');
  git('update-ref', 'refs/heads/staging', 'main');
  git('update-ref', 'refs/heads/main', 'main');
  pushAll();
  git('fetch', '-q', 'origin');
  const result = plan(cwd, 'stg-v0.1.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be on staging/);
});

test('lần đầu phát hành lập kế hoạch build thành phần có Dockerfile', () => {
  const { cwd, git, pushAll } = createRepository();
  git('tag', 'stg-v0.1.0');
  pushAll();
  git('fetch', '-q', 'origin');
  const result = plan(cwd, 'stg-v0.1.0');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"id":"identity"/);
});

test('bản sau chỉ đổi tài liệu thì không build gì', () => {
  const { cwd, git, change, pushAll } = createRepository();
  git('tag', 'stg-v0.1.0');
  change('docs/more.txt', 'docs: add note');
  git('tag', 'stg-v0.1.1');
  pushAll();
  git('fetch', '-q', 'origin');
  const result = plan(cwd, 'stg-v0.1.1');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Components for stg-v0\.1\.1: \[\]/);
});
