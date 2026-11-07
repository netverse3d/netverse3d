import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const CLI = 'node_modules/@commitlint/cli/cli.js';

function lint(message) {
  return spawnSync(process.execPath, [CLI], { input: message, encoding: 'utf8' });
}

test('từ chối commit không theo conventional', () => {
  assert.notEqual(lint('update some files\n').status, 0);
});

test('từ chối commit có loại không hợp lệ', () => {
  assert.notEqual(lint('stuff: let players log in\n').status, 0);
});

test('từ chối commit có thân văn xuôi', () => {
  assert.notEqual(lint('feat: let players log in\n\nThis adds a login form.\n').status, 0);
});

test('nhận commit chỉ có tiêu đề', () => {
  const result = lint('feat: let players log in\n');
  assert.equal(result.status, 0, result.stdout);
});

test('nhận commit có trailer đồng tác giả', () => {
  const result = lint(
    'chore: add workspace tooling\n\nCo-Authored-By: Someone <someone@example.test>\n',
  );
  assert.equal(result.status, 0, result.stdout);
});

test('nhận commit có trailer truy vết yêu cầu', () => {
  const result = lint('feat: let players log in\n\nRefs: REQ-001\n');
  assert.equal(result.status, 0, result.stdout);
});
