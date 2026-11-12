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
  - id: media
    path: services/media
    kind: service
    stack: NestJS
    summary: Media
    milestone: M2
  - id: contracts
    path: packages/contracts
    kind: package
    stack: JSON Schema
    summary: Contracts
    milestone: M0
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
  const write = (file, content) => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), content);
  };
  const change = (file, message) => {
    write(file, `${message}\n`);
    git('add', '-A');
    git('commit', '-qm', message);
  };
  write('seed.txt', 'seed\n');
  write('docs/catalog.yaml', CATALOG);
  write('services/identity/Dockerfile', 'FROM scratch\n');
  write(
    'services/identity/package.json',
    '{"name":"@netverse/identity","dependencies":{"@netverse/contracts":"workspace:*"}}\n',
  );
  write('services/media/Dockerfile', 'FROM scratch\n');
  write('services/media/package.json', '{"name":"@netverse/media"}\n');
  write('packages/contracts/package.json', '{"name":"@netverse/contracts"}\n');
  git('add', '-A');
  git('commit', '-qm', 'chore: base');
  git('switch', '-qc', 'staging');
  change('docs/feature.txt', 'feat: add feature');
  const promote = () => {
    git('switch', '-q', 'main');
    git('merge', '-q', '--no-ff', '--no-edit', 'staging');
  };
  const pushAll = () => {
    git('push', '-q', 'origin', 'main', 'staging', '--tags', '--force');
    git('fetch', '-q', 'origin');
  };
  return { cwd, git, change, promote, pushAll };
}

function validate(cwd, component, environment, version, branch, extra = []) {
  return spawnSync(
    process.execPath,
    [
      VALIDATE,
      '--component',
      component,
      '--environment',
      environment,
      '--version',
      version,
      '--branch',
      branch,
      ...extra,
    ],
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

test('chạy trọn vòng staging rồi production cho một thành phần', () => {
  const { cwd, git, promote } = createRepository();
  const staged = validate(cwd, 'identity', 'staging', '0.1.0', 'staging');
  assert.equal(staged.status, 0, staged.stderr);
  assert.match(staged.stdout, /Ready to release identity\/stg-v0\.1\.0/);
  git('tag', 'identity/stg-v0.1.0');
  promote();
  const result = validate(cwd, 'identity', 'production', '0.1.0', 'main');
  assert.equal(result.status, 0, result.stderr);
});

test('production qua khi main có thay đổi của thành phần khác chưa phát hành', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  change('services/media/src/half-done.txt', 'feat: unfinished media work');
  change('docs/note.txt', 'docs: add note');
  promote();
  const result = validate(cwd, 'identity', 'production', '0.1.0', 'main');
  assert.equal(result.status, 0, result.stderr);
});

test('từ chối production khi chính thành phần đó có thay đổi chưa test', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  change('services/identity/src/untested.txt', 'fix: change not tested');
  promote();
  const result = validate(cwd, 'identity', 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content of identity differs/);
});

test('từ chối production khi package mà thành phần phụ thuộc có thay đổi chưa test', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  change('packages/contracts/events/v1/a.json', 'feat: change a contract');
  promote();
  const blocked = validate(cwd, 'identity', 'production', '0.1.0', 'main');
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /content of identity differs/);
});

test('thành phần không phụ thuộc package vừa đổi thì vẫn lên production được', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'media/stg-v0.1.0');
  change('packages/contracts/events/v1/a.json', 'feat: change a contract');
  promote();
  const result = validate(cwd, 'media', 'production', '0.1.0', 'main');
  assert.equal(result.status, 0, result.stderr);
});

test('từ chối production khi tệp gốc dùng chung có thay đổi chưa test', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'media/stg-v0.1.0');
  change('pnpm-lock.yaml', 'chore: bump a dependency');
  promote();
  const result = validate(cwd, 'media', 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content of media differs/);
});

test('từ chối production khi chưa phát hành staging của chính thành phần đó', () => {
  const { cwd, git, promote } = createRepository();
  git('tag', 'media/stg-v0.1.0');
  promote();
  const result = validate(cwd, 'identity', 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /identity\/stg-v0\.1\.0 does not exist/);
});

test('từ chối phát hành lại số đã có', () => {
  const { cwd, git } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  const result = validate(cwd, 'identity', 'staging', '0.1.0', 'staging');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
});

test('từ chối số phiên bản thấp hơn bản trước của cùng thành phần', () => {
  const { cwd, git } = createRepository();
  git('tag', 'identity/stg-v0.2.0');
  const result = validate(cwd, 'identity', 'staging', '0.1.5', 'staging');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /0\.1\.5 must be greater than 0\.2\.0/);
});

test('hai thành phần đánh số độc lập với nhau', () => {
  const { cwd, git } = createRepository();
  git('tag', 'identity/stg-v2.0.0');
  const result = validate(cwd, 'media', 'staging', '0.1.0', 'staging');
  assert.equal(result.status, 0, result.stderr);
});

test('từ chối thành phần không có Dockerfile hoặc không có trong catalog', () => {
  const { cwd } = createRepository();
  const library = validate(cwd, 'contracts', 'staging', '0.1.0', 'staging');
  assert.equal(library.status, 1);
  assert.match(library.stderr, /"contracts" is not a deployable component/);
  const unknown = validate(cwd, 'ghost', 'staging', '0.1.0', 'staging');
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /"ghost" is not a deployable component/);
});

test('sửa lỗi một thành phần đi qua staging nhiều vòng mà không cần merge ngược', () => {
  const { cwd, git, change, promote } = createRepository();
  const checks = join(cwd, '.git/checks.json');
  writeFileSync(
    checks,
    JSON.stringify([
      { name: 'verify', conclusion: 'success', app: { slug: 'github-actions' } },
      { name: 'secrets', conclusion: 'success', app: { slug: 'github-actions' } },
    ]),
  );
  for (const [version, file] of [
    ['0.1.0', 'services/identity/src/first.txt'],
    ['0.1.1', 'services/identity/src/second.txt'],
    ['0.1.2', 'services/identity/src/third.txt'],
  ]) {
    git('switch', '-q', 'staging');
    change(file, 'fix: urgent repair');
    const staged = validate(cwd, 'identity', 'staging', version, 'staging', [
      '--checks-file',
      checks,
    ]);
    assert.equal(staged.status, 0, staged.stderr);
    git('tag', `identity/stg-v${version}`);
    promote();
    const released = validate(cwd, 'identity', 'production', version, 'main', [
      '--checks-file',
      checks,
    ]);
    assert.equal(released.status, 0, released.stderr);
    git('tag', `identity/prod-v${version}`);
  }
});

test('tag sai định dạng hoặc thiếu mã thành phần không được lập kế hoạch build', () => {
  const { cwd } = createRepository();
  for (const tag of ['v1.0.0', 'stg-v1.0.0']) {
    const result = plan(cwd, tag);
    assert.equal(result.status, 1, tag);
    assert.match(result.stderr, /not a valid release tag/);
  }
});

test('tag staging đặt ngoài nhánh cho phép bị từ chối', () => {
  const { cwd, git, pushAll } = createRepository();
  git('switch', '-qc', 'feat/x');
  git('tag', 'identity/stg-v0.1.0');
  git('switch', '-q', 'staging');
  git('update-ref', 'refs/heads/staging', 'main');
  pushAll();
  const result = plan(cwd, 'identity/stg-v0.1.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be on staging/);
});

test('tag staging chỉ lập kế hoạch build đúng thành phần của tag', () => {
  const { cwd, git, pushAll } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  pushAll();
  const result = plan(cwd, 'identity/stg-v0.1.0');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"id":"identity"/);
  assert.match(result.stdout, /"version":"0\.1\.0"/);
  assert.doesNotMatch(result.stdout, /"id":"media"/);
});

test('tag của thành phần không triển khai được bị từ chối lúc lập kế hoạch', () => {
  const { cwd, git, pushAll } = createRepository();
  git('tag', 'contracts/stg-v0.1.0');
  pushAll();
  const result = plan(cwd, 'contracts/stg-v0.1.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"contracts" is not a deployable component/);
});

test('tag production lấy image của bản staging cùng số', () => {
  const { cwd, git, change, promote, pushAll } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  change('services/media/src/later.txt', 'feat: change media later');
  promote();
  git('tag', 'identity/prod-v0.1.0');
  pushAll();
  const result = plan(cwd, 'identity/prod-v0.1.0');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"sourceTag":"identity\/stg-v0\.1\.0"/);
});

test('tag production bị từ chối khi nội dung thành phần khác bản staging cùng số', () => {
  const { cwd, git, change, promote, pushAll } = createRepository();
  git('tag', 'identity/stg-v0.1.0');
  change('services/identity/src/untested.txt', 'fix: change not tested');
  promote();
  git('tag', 'identity/prod-v0.1.0');
  pushAll();
  const result = plan(cwd, 'identity/prod-v0.1.0');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content of identity differs/);
});

test('từ chối production khi thành phần bỏ khai phụ thuộc rồi package đó đổi', () => {
  const { cwd, git, change, promote } = createRepository();
  const withDependency = CATALOG.replace(
    '    summary: Media\n    milestone: M2\n',
    '    summary: Media\n    milestone: M2\n    depends_on: [contracts]\n',
  );
  writeFileSync(join(cwd, 'docs/catalog.yaml'), withDependency);
  git('add', '-A');
  git('commit', '-qm', 'chore: declare a dependency');
  git('tag', 'media/stg-v0.1.0');
  writeFileSync(join(cwd, 'docs/catalog.yaml'), CATALOG);
  git('add', '-A');
  git('commit', '-qm', 'chore: drop the dependency');
  change('packages/contracts/events/v1/a.json', 'feat: change a contract');
  promote();
  const result = validate(cwd, 'media', 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content of media differs/);
});

test('từ chối production khi tệp quyết định nội dung image đổi sau bản staging', () => {
  const { cwd, git, change, promote } = createRepository();
  git('tag', 'media/stg-v0.1.0');
  change('.dockerignore', 'chore: change what enters images');
  promote();
  const result = validate(cwd, 'media', 'production', '0.1.0', 'main');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /content of media differs/);
});
