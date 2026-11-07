import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { api, gh, ghJson, ORGANIZATION, REPOSITORY } from './gh.mjs';

export const PROJECT_TITLE = 'Netverse 3D';
const STATUS_OPTIONS = ['Backlog', 'Ready', 'In Progress', 'In Review', 'Done'];
const VIEWS = [
  { name: 'Bảng công việc', layout: 'board', filter: '-status:Done' },
  { name: 'Theo Milestone', layout: 'table' },
  { name: 'Theo người', layout: 'table', filter: '-status:Done' },
  { name: 'Lộ trình', layout: 'roadmap' },
  { name: 'Cần chốt', layout: 'table', filter: 'label:needs-decision,waiting-mentor' },
];
const FIELDS = [
  { name: 'Priority', options: ['P0', 'P1', 'P2', 'P3'] },
  { name: 'Size', options: ['XS', 'S', 'M', 'L', 'XL'] },
];

function findProject() {
  const { projects } = ghJson(['project', 'list', '--owner', ORGANIZATION, '--format', 'json']);
  return projects.find((project) => project.title === PROJECT_TITLE);
}

function ensureProject() {
  const project = findProject();
  if (project) return project;
  return ghJson([
    'project',
    'create',
    '--owner',
    ORGANIZATION,
    '--title',
    PROJECT_TITLE,
    '--format',
    'json',
  ]);
}

function listFields(number) {
  const args = [
    'project',
    'field-list',
    String(number),
    '--owner',
    ORGANIZATION,
    '--format',
    'json',
  ];
  return ghJson(args).fields;
}

function ensureFields(number) {
  const fields = listFields(number);
  for (const field of FIELDS) {
    if (fields.some((item) => item.name === field.name)) continue;
    gh([
      'project',
      'field-create',
      String(number),
      '--owner',
      ORGANIZATION,
      '--name',
      field.name,
      '--data-type',
      'SINGLE_SELECT',
      '--single-select-options',
      field.options.join(','),
    ]);
  }
}

function ensureStatusOptions(number) {
  const status = listFields(number).find((field) => field.name === 'Status');
  const current = status.options.map((option) => option.name);
  if (STATUS_OPTIONS.every((name) => current.includes(name))) return;
  const options = STATUS_OPTIONS.map(
    (name) => `{name: ${JSON.stringify(name)}, color: GRAY, description: ""}`,
  ).join(', ');
  const query = `mutation { updateProjectV2Field(input: {fieldId: "${status.id}", singleSelectOptions: [${options}]}) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }`;
  gh(['api', 'graphql', '-f', `query=${query}`]);
}

function ensureViews(number) {
  const query = `query { organization(login: "${ORGANIZATION}") { projectV2(number: ${number}) { views(first: 50) { nodes { name } } } } }`;
  const result = ghJson(['api', 'graphql', '-f', `query=${query}`]);
  const existing = result.data.organization.projectV2.views.nodes.map((view) => view.name);
  for (const view of VIEWS) {
    if (existing.includes(view.name)) continue;
    api('POST', `orgs/${ORGANIZATION}/projectsV2/${number}/views`, view);
  }
}

function ensureMilestones() {
  const { milestones } = parse(readFileSync('docs/requirements/milestones.yaml', 'utf8'));
  const existing = api('GET', `repos/${REPOSITORY}/milestones?state=all&per_page=100`);
  for (const milestone of milestones) {
    const body = { title: milestone.title, description: milestone.goal };
    const current = existing.find((item) => item.title === milestone.title);
    if (!current) api('POST', `repos/${REPOSITORY}/milestones`, body);
    else if (current.description !== milestone.goal) {
      api('PATCH', `repos/${REPOSITORY}/milestones/${current.number}`, body);
    }
  }
  return milestones.length;
}

const project = ensureProject();
gh(['project', 'link', String(project.number), '--owner', ORGANIZATION, '--repo', REPOSITORY]);
gh(['project', 'edit', String(project.number), '--owner', ORGANIZATION, '--visibility', 'PUBLIC']);
ensureFields(project.number);
ensureStatusOptions(project.number);
ensureViews(project.number);
const milestoneCount = ensureMilestones();

const fields = listFields(project.number).map((field) => field.name);
const missing = ['Status', ...FIELDS.map((field) => field.name)].filter(
  (name) => !fields.includes(name),
);
if (missing.length > 0) {
  console.error(`Project is missing fields: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Project #${project.number} ready: ${project.url}. Milestones: ${milestoneCount}.`);
}
