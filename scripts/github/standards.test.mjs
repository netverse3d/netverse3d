import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';

const REQUIRED_ISSUE_DETAILS = [
  'Assignees',
  'Labels',
  'Type',
  'Priority',
  'Effort',
  'Start date',
  'Target date',
];
const TEMPLATE_DIRECTORY = '.github/ISSUE_TEMPLATE';

function issueTemplates() {
  return readdirSync(TEMPLATE_DIRECTORY)
    .filter((name) => name.endsWith('.yml') && name !== 'config.yml')
    .map((name) => ({ name, ...parse(readFileSync(`${TEMPLATE_DIRECTORY}/${name}`, 'utf8')) }));
}

function requiredFieldIds(template) {
  return template.body
    .filter((field) => field.validations?.required === true)
    .map((field) => field.id);
}

test('tài liệu đóng góp nêu đủ bảy thông tin bắt buộc của issue', () => {
  const guide = readFileSync('CONTRIBUTING.md', 'utf8');
  for (const detail of REQUIRED_ISSUE_DETAILS) {
    assert.ok(guide.includes(detail), `CONTRIBUTING.md thiếu ${detail}`);
  }
});

test('tài liệu đóng góp yêu cầu mỗi PR vào staging đóng một issue', () => {
  const guide = readFileSync('CONTRIBUTING.md', 'utf8');
  assert.match(guide, /Closes #/);
  assert.match(guide, /staging/);
});

test('mẫu issue nào cũng bắt buộc ô bối cảnh và ô xong khi nào', () => {
  const templates = issueTemplates();
  assert.ok(templates.length >= 4);
  for (const template of templates) {
    const required = requiredFieldIds(template);
    assert.ok(required.includes('context'), `${template.name} thiếu ô bối cảnh bắt buộc`);
    assert.ok(required.includes('done'), `${template.name} thiếu ô xong khi nào bắt buộc`);
  }
});

test('mẫu issue nào cũng nhắc điền thông tin ở thanh bên', () => {
  for (const template of issueTemplates()) {
    const reminder = template.body.find((field) => field.type === 'markdown');
    assert.ok(reminder, `${template.name} thiếu lời nhắc`);
    for (const detail of ['Assignees', 'Priority', 'Effort']) {
      assert.ok(reminder.attributes.value.includes(detail), `${template.name} thiếu ${detail}`);
    }
  }
});
