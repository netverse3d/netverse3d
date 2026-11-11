import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { parse } from 'yaml';
import { loadRegistry } from '../trace/lib.mjs';
import {
  findIssueByKey,
  findUnknownMilestones,
  issueFieldInputs,
  planBacklog,
  planBodyUpdates,
  planFieldUpdates,
  planMilestoneMoves,
  selectMissingIssues,
} from './backlog.mjs';
import { api, gh, ghJson, ORGANIZATION, PROJECT_TITLE, REPOSITORY } from './gh.mjs';

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
}

const ISSUE_FIELDS_QUERY = `query($organization: String!) {
  organization(login: $organization) {
    issueFields(first: 50) {
      nodes {
        ... on IssueFieldSingleSelect { id name options { id name } }
        ... on IssueFieldDate { id name }
      }
    }
  }
}`;

const SET_ISSUE_FIELDS_MUTATION = `mutation($issueId: ID!, $issueFields: [IssueFieldCreateOrUpdateInput!]!) {
  setIssueFieldValue(input: { issueId: $issueId, issueFields: $issueFields }) {
    clientMutationId
  }
}`;

function graphql(query, variables) {
  return ghJson(
    ['api', 'graphql', '-H', 'GraphQL-Features: issue_fields', '--input', '-'],
    JSON.stringify({ query, variables }),
  ).data;
}

function loadIssueFields() {
  return graphql(ISSUE_FIELDS_QUERY, { organization: ORGANIZATION }).organization.issueFields.nodes;
}

function setIssueFields(fields, nodeId, values) {
  const issueFields = issueFieldInputs(fields, values);
  if (issueFields.length === 0) return;
  graphql(SET_ISSUE_FIELDS_MUTATION, { issueId: nodeId, issueFields });
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
const unknownMilestones = findUnknownMilestones(planned, [...milestoneNumbers.keys()]);
if (unknownMilestones.length > 0) {
  console.error(`Milestones not found: ${unknownMilestones.join(', ')}. Run setup-project first.`);
  process.exit(1);
}
const existing = listIssues();
const issueFields = loadIssueFields();
const nodeIds = new Map(existing.map((item) => [item.number, item.node_id]));
const bodyUpdates = planBodyUpdates(planned, existing);
const fieldUpdates = planFieldUpdates(planned, existing);

if (process.argv.includes('--dry-run')) {
  for (const move of planMilestoneMoves(planned, existing)) {
    console.log(`Would move #${move.number}: ${move.from ?? 'none'} -> ${move.to}`);
  }
  for (const update of bodyUpdates) console.log(`Would rewrite the body of #${update.number}`);
  for (const update of fieldUpdates) {
    console.log(
      `Would set #${update.number}: Priority ${update.priority}, Effort ${update.effort ?? 'unchanged'}`,
    );
  }
  const absent = selectMissingIssues(
    planned,
    existing.map((item) => item.title),
  );
  for (const issue of absent) console.log(`Would create: ${issue.title}`);
  console.log(
    `Dry run: ${bodyUpdates.length} bodies, ${fieldUpdates.length} field updates, ${absent.length} new issues.`,
  );
  process.exit(0);
}

for (const update of bodyUpdates) {
  api('PATCH', `${repositoryPath}/issues/${update.number}`, { body: update.body });
  console.log(`Rewrote the body of #${update.number}`);
  await sleep(REQUEST_GAP_MS);
}
for (const update of fieldUpdates) {
  setIssueFields(issueFields, nodeIds.get(update.number), update);
  console.log(`Set fields of #${update.number}`);
  await sleep(REQUEST_GAP_MS);
}
for (const move of planMilestoneMoves(planned, existing)) {
  api('PATCH', `${repositoryPath}/issues/${move.number}`, {
    milestone: milestoneNumbers.get(move.to),
  });
  console.log(`Moved #${move.number}: ${move.from ?? 'none'} -> ${move.to}`);
  await sleep(REQUEST_GAP_MS);
}
const missing = selectMissingIssues(
  planned,
  existing.map((item) => item.title),
);
console.log(`Planned ${planned.length} issues, ${planned.length - missing.length} already exist.`);

for (const issue of missing.filter((item) => item.type === 'Feature')) {
  const created = createIssue(issue, milestoneNumbers);
  existing.push(created);
  addToProject(project, issue, created.html_url);
  setIssueFields(issueFields, created.node_id, issue);
  console.log(`Created #${created.number}: ${issue.title}`);
  await sleep(REQUEST_GAP_MS);
}

for (const issue of missing.filter((item) => item.type === 'Task')) {
  const created = createIssue(issue, milestoneNumbers);
  addToProject(project, issue, created.html_url);
  setIssueFields(issueFields, created.node_id, issue);
  const parentIssue = findIssueByKey(existing, issue.parent);
  api('POST', `${repositoryPath}/issues/${parentIssue.number}/sub_issues`, {
    sub_issue_id: created.id,
  });
  console.log(`Created #${created.number}: ${issue.title}, child of #${parentIssue.number}`);
  await sleep(REQUEST_GAP_MS);
}
