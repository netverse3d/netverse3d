import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLISHED = JSON.stringify({ $id: 'https://x.test/a', title: 'A', type: 'object' });
const DRAFT = JSON.stringify({
  $id: 'https://x.test/d',
  title: 'D',
  type: 'object',
  'x-status': 'draft',
});

function createRepository(files) {
  const cwd = mkdtempSync(join(tmpdir(), 'contracts-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'staging');
  git('config', 'user.name', 'Sim');
  git('config', 'user.email', 'sim@example.test');
  for (const file of ['check.mjs', 'lib.mjs']) cpSync(join(HERE, file), join(cwd, file));
  symlinkSync(resolve(HERE, 'node_modules'), join(cwd, 'node_modules'), 'junction');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(cwd, 'package.json'), '{"type":"module"}\n');
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), content);
  }
  git('add', '-A');
  git('commit', '-qm', 'chore: base');
  return cwd;
}

function check(cwd) {
  return spawnSync(process.execPath, ['check.mjs', '--base', 'HEAD'], { cwd, encoding: 'utf8' });
}

test('tệp lồng trong thư mục con không đổi thì không bị báo là đã xoá', () => {
  const cwd = createRepository({ 'events/sub/a.schema.json': PUBLISHED });
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});

test('xoá hợp đồng chính thức trong thư mục con bị chặn', () => {
  const cwd = createRepository({ 'events/sub/a.schema.json': PUBLISHED });
  rmSync(join(cwd, 'events/sub/a.schema.json'));
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /a published file was removed/);
});

test('hợp đồng dữ liệu thế giới trong thư mục world cũng được kiểm', () => {
  const cwd = createRepository({
    'world/shop.schema.json': JSON.stringify({ title: 'Shop', type: 'object' }),
  });
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /world\/shop\.schema\.json: missing \$id/);
});

test('xoá tệp cuối cùng của thư mục không làm công cụ hỏng', () => {
  const cwd = createRepository({ 'realtime/d.schema.json': DRAFT });
  rmSync(join(cwd, 'realtime'), { recursive: true });
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});
