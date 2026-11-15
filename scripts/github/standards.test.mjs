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

function dropdownOptions(template, id) {
  const field = template.body.find((item) => item.id === id);
  assert.equal(field?.type, 'dropdown', `${template.name} phải dùng dropdown cho ${id}`);
  return field.attributes.options;
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
    for (const detail of ['Assignees', 'Area', 'Milestone', 'Priority', 'đồng bộ']) {
      assert.ok(reminder.attributes.value.includes(detail), `${template.name} thiếu ${detail}`);
    }
    if (template.type === 'Feature') {
      assert.ok(reminder.attributes.value.includes('Effort không bắt buộc'));
    } else {
      assert.ok(reminder.attributes.value.includes('Effort'));
    }
  }
});

test('mẫu issue bắt buộc chọn area, milestone và Priority', () => {
  for (const template of issueTemplates()) {
    const required = requiredFieldIds(template);
    for (const field of ['area', 'milestone', 'priority']) {
      assert.ok(required.includes(field), `${template.name} thiếu dropdown ${field} bắt buộc`);
    }
  }
});

test('Effort bắt buộc ở Task và Bug, còn Feature không yêu cầu Effort', () => {
  for (const template of issueTemplates()) {
    const required = requiredFieldIds(template);
    if (template.type === 'Feature') {
      assert.ok(!required.includes('effort'), `${template.name} không được bắt Effort`);
    } else {
      assert.ok(required.includes('effort'), `${template.name} thiếu Effort bắt buộc`);
    }
  }
});

test('lựa chọn metadata trong form khớp danh mục và field của repo', () => {
  const catalog = parse(readFileSync('docs/catalog.yaml', 'utf8'));
  const milestones = parse(readFileSync('docs/requirements/milestones.yaml', 'utf8'))
    .milestones.map((milestone) => milestone.title)
    .sort();
  const expectedAreas = [
    ...catalog.components.map((component) => `area:${component.id}`),
    'area:docs',
    'area:infra',
  ].sort();
  const expectedPriority = ['Urgent', 'High', 'Medium', 'Low'];
  const expectedEffort = ['High', 'Medium', 'Low'];

  for (const template of issueTemplates()) {
    assert.deepEqual(
      [...dropdownOptions(template, 'area')].sort(),
      expectedAreas,
      `${template.name} lệch danh sách area`,
    );
    assert.deepEqual(
      [...dropdownOptions(template, 'milestone')].sort(),
      milestones,
      `${template.name} lệch milestone`,
    );
    assert.deepEqual(
      dropdownOptions(template, 'priority'),
      expectedPriority,
      `${template.name} lệch Priority`,
    );
    if (template.type !== 'Feature') {
      assert.deepEqual(
        dropdownOptions(template, 'effort'),
        expectedEffort,
        `${template.name} lệch Effort`,
      );
    }
  }
});

test('tài liệu hướng dẫn đồng bộ metadata từ form và xử lý needs-triage', () => {
  const guide = readFileSync('CONTRIBUTING.md', 'utf8');
  const workflow = readFileSync('docs/wiki/team/workflow.md', 'utf8');
  const runbook = readFileSync('docs/runbooks/issue-quality.md', 'utf8');

  for (const document of [guide, workflow, runbook]) {
    assert.match(document, /needs-triage/);
    assert.match(document, /Priority/);
    assert.match(document, /Effort/);
  }

  assert.match(guide, /dropdown bắt buộc trong form/i);
  assert.match(guide, /đồng bộ/);
  assert.match(workflow, /pnpm issues:audit/);
  assert.match(runbook, /pnpm issues:audit --apply/);
  assert.match(runbook, /đọc.*trước.*ghi|preview/i);
  assert.match(runbook, /GITHUB_TOKEN/);
  assert.match(runbook, /Closes #/);
});
