import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPatterns, findMatches } from './denylist.mjs';

const SCANNER = resolve(dirname(fileURLToPath(import.meta.url)), 'scan-denylist.mjs');
const FAKE_STUDENT_ID = ['SE', '000001'].join('');

function createRepository(content, message = 'chore: base') {
  const cwd = mkdtempSync(join(tmpdir(), 'denylist-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'staging');
  git('config', 'user.name', 'Sim');
  git('config', 'user.email', 'sim@example.test');
  writeFileSync(join(cwd, 'note.txt'), content);
  git('add', '-A');
  git('commit', '-qm', message);
  return cwd;
}

function scan(cwd, env, ...args) {
  return spawnSync(process.execPath, [SCANNER, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, DENYLIST_PATTERNS: '', ...env },
  });
}

test('phát hiện mã số sinh viên mà không cần cấu hình thêm', () => {
  const findings = findMatches('a.md', `x\nMSSV ${FAKE_STUDENT_ID}\n`, buildPatterns());
  assert.deepEqual(findings, [{ file: 'a.md', line: 2 }]);
});

test('phát hiện từ cấm từ cấu hình, không phân biệt hoa thường', () => {
  const findings = findMatches('a.md', 'made by ACME corp', buildPatterns('acme'));
  assert.equal(findings.length, 1);
});

test('phát hiện từ cấm trong tên tệp', () => {
  const findings = findMatches('acme/readme.md', 'clean', buildPatterns('acme'));
  assert.deepEqual(findings, [{ file: 'acme/readme.md', line: 0 }]);
});

test('bỏ qua nội dung nhị phân', () => {
  assert.deepEqual(findMatches('a.bin', 'acme\0', buildPatterns('acme')), []);
});

test('không báo gì khi nội dung sạch', () => {
  assert.deepEqual(findMatches('a.md', 'REQ-001 SE1234', buildPatterns('acme')), []);
});

test('quét chặn tệp đã track chứa từ cấm và không in từ đó ra', () => {
  const cwd = createRepository('made by acme\n');
  const result = scan(cwd, { DENYLIST_PATTERNS: 'acme' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /note\.txt:1/);
  assert.doesNotMatch(result.stderr, /acme/);
});

test('quét chặn thông điệp commit chứa từ cấm', () => {
  const cwd = createRepository('clean\n', 'chore: import from acme');
  const result = scan(cwd, { DENYLIST_PATTERNS: 'acme' }, '--commit-range', 'HEAD');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit /);
});

test('báo lỗi khi bắt buộc cấu hình mà cấu hình rỗng', () => {
  const cwd = createRepository('clean\n');
  const result = scan(cwd, {}, '--require-env');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DENYLIST_PATTERNS is empty/);
});

test('quét qua khi repo sạch', () => {
  const cwd = createRepository('clean\n');
  assert.equal(scan(cwd, { DENYLIST_PATTERNS: 'acme' }, '--require-env').status, 0);
});
