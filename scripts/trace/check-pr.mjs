import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { argument } from '../lib/cli.mjs';
import { gitLines, gitOutputOrNull } from '../lib/git.mjs';
import {
  evaluateBranchFlow,
  evaluatePullRequest,
  isTraceExempt,
  loadDecisions,
  loadRegistry,
  validateDecisions,
  validateRegistry,
} from './lib.mjs';

const root = process.cwd();
const base = argument('base');
const head = argument('head');
const baseRef = argument('base-ref') ?? `origin/${base}`;
const author = argument('author');
const isFork = argument('head-repository') !== process.env.GITHUB_REPOSITORY;
const body = readFileSync(argument('body-file'), 'utf8');
const files = gitLines(['diff', '--name-only', `${baseRef}...HEAD`], root);

function loadBaseRequirementIds() {
  const text = gitOutputOrNull(['show', `${baseRef}:docs/requirements/registry.yaml`], root);
  if (text === null) return null;
  return (parse(text)?.requirements ?? []).map((item) => item.id);
}

function loadBaseDecisionIds() {
  const names = gitOutputOrNull(['ls-tree', '--name-only', baseRef, 'docs/decisions/'], root);
  if (names === null) return null;
  return names.split('\n').map((name) => name.split('/').pop().slice(0, 8));
}

const requirements = loadRegistry(root);
const decisions = loadDecisions(root);
const result = evaluatePullRequest({
  body,
  files,
  requirements,
  decisions,
  exempt: isTraceExempt({ base, head, isFork, author }),
  baseRequirementIds: loadBaseRequirementIds(),
  baseDecisionIds: loadBaseDecisionIds(),
});
const errors = [
  ...validateRegistry(requirements),
  ...validateDecisions(decisions),
  ...evaluateBranchFlow({ base, head, isFork }),
  ...result.errors,
];

for (const warning of result.warnings) console.log(`::warning::${warning}`);
for (const error of errors) console.log(`::error::${error}`);

if (errors.length > 0) {
  console.log(
    'This pull request cannot be traced to an agreed requirement. Reference an accepted REQ or ADR in the description, or record the new decision first.',
  );
  process.exitCode = 1;
} else {
  console.log(
    `Traceability passed: ${result.references.join(', ') || 'no references were required'}.`,
  );
}
