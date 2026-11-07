import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findMatches } from './denylist.mjs';

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

function scan(cwd, ...args) {
  return spawnSync(process.execPath, [SCANNER, ...args], { cwd, encoding: 'utf8' });
}

test('phát hiện mã số sinh viên trong nội dung', () => {
  const findings = findMatches('a.md', `x\nMSSV ${FAKE_STUDENT_ID}\n`);
  assert.deepEqual(findings, [{ file: 'a.md', line: 2 }]);
});

test('phát hiện mã số sinh viên trong tên tệp', () => {
  const findings = findMatches(`${FAKE_STUDENT_ID}.md`, 'clean');
  assert.deepEqual(findings, [{ file: `${FAKE_STUDENT_ID}.md`, line: 0 }]);
});

test('bỏ qua nội dung nhị phân', () => {
  assert.deepEqual(findMatches('a.bin', `${FAKE_STUDENT_ID}\0`), []);
});

test('không nhầm với mã yêu cầu hoặc chuỗi ngắn hơn', () => {
  assert.deepEqual(findMatches('a.md', 'REQ-001 SE1234 SE12345'), []);
});

test('quét chặn tệp đã track và không in mã số ra', () => {
  const cwd = createRepository(`MSSV ${FAKE_STUDENT_ID}\n`);
  const result = scan(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /note\.txt:1/);
  assert.doesNotMatch(result.stderr, new RegExp(FAKE_STUDENT_ID));
});

test('quét chặn thông điệp commit chứa mã số sinh viên', () => {
  const cwd = createRepository('clean\n', `chore: add ${FAKE_STUDENT_ID}`);
  const result = scan(cwd, '--commit-range', 'HEAD');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit /);
});

test('quét qua khi repo sạch', () => {
  assert.equal(scan(createRepository('clean\n')).status, 0);
});
