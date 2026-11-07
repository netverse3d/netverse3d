import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { parse } from 'yaml';
import { loadRegistry } from '../trace/lib.mjs';
import { planBacklog, selectMissingIssues } from './backlog.mjs';
import { api, gh, ghJson, ORGANIZATION, REPOSITORY } from './gh.mjs';

const PROJECT_TITLE = 'Netverse 3D';
const REQUEST_GAP_MS = 1200;
const repositoryPath = `repos/${REPOSITORY}`;

function readPlan() {
  const seed = parse(readFileSync('docs/requirements/backlog-seed.yaml', 'utf8'));
  const { milestones } = parse(readFileSync('docs/requirements/milestones.yaml', 'utf8'));
  return planBacklog(loadRegistry(process.cwd()), seed, milestones);
}

function listIssues() {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = api('GET', `${repositoryPath}/issues?state=all&per_page=100&page=${page}`);
    issues.push(...batch.filter((item) => !item.pull_request));
    if (batch.length < 100) return issues;
  }
}

function loadProject() {
  const { projects } = ghJson(['project', 'list', '--owner', ORGANIZATION, '--format', 'json']);
  const project = projects.find((item) => item.title === PROJECT_TITLE);
  if (!project) throw new Error(`Project "${PROJECT_TITLE}" not found. Run setup-project first.`);
  const { fields } = ghJson([
    'project',
    'field-list',
    String(project.number),
    '--owner',
    ORGANIZATION,
    '--format',
    'json',
  ]);
  return { ...project, fields };
}

function setField(project, itemId, fieldName, optionName) {
  if (!optionName) return;
  const field = project.fields.find((item) => item.name === fieldName);
  const option = field?.options?.find((item) => item.name === optionName);
  if (!option) throw new Error(`Project field ${fieldName} has no option ${optionName}`);
  gh([
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    project.id,
    '--field-id',
    field.id,
    '--single-select-option-id',
    option.id,
  ]);
}

function createIssue(issue, milestoneNumbers) {
  return api('POST', `${repositoryPath}/issues`, {
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    milestone: milestoneNumbers.get(issue.milestone),
    type: issue.type,
  });
}

function addToProject(project, issue, url) {
  const item = ghJson([
    'project',
    'item-add',
    String(project.number),
    '--owner',
    ORGANIZATION,
    '--url',
    url,
    '--format',
    'json',
  ]);
  setField(project, item.id, 'Status', issue.status);
  setField(project, item.id, 'Priority', issue.priority);
  setField(project, item.id, 'Size', issue.size);
}

const { issues: planned, errors } = readPlan();
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const project = loadProject();
const milestoneNumbers = new Map(
  api('GET', `${repositoryPath}/milestones?state=all&per_page=100`).map((item) => [
    item.title,
    item.number,
  ]),
);
const existing = listIssues();
const missing = selectMissingIssues(
  planned,
  existing.map((item) => item.title),
);
const byTitle = new Map(existing.map((item) => [item.title, item]));
console.log(`Planned ${planned.length} issues, ${planned.length - missing.length} already exist.`);

for (const issue of missing.filter((item) => item.type === 'Feature')) {
  const created = createIssue(issue, milestoneNumbers);
  byTitle.set(issue.title, created);
  addToProject(project, issue, created.html_url);
  console.log(`Created #${created.number}: ${issue.title}`);
  await sleep(REQUEST_GAP_MS);
}

for (const issue of missing.filter((item) => item.type === 'Task')) {
  const created = createIssue(issue, milestoneNumbers);
  addToProject(project, issue, created.html_url);
  const parent = planned.find((item) => item.key === issue.parent);
  const parentIssue = byTitle.get(parent.title);
  api('POST', `${repositoryPath}/issues/${parentIssue.number}/sub_issues`, {
    sub_issue_id: created.id,
  });
  console.log(`Created #${created.number}: ${issue.title}, child of #${parentIssue.number}`);
  await sleep(REQUEST_GAP_MS);
}
