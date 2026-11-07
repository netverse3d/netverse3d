import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  evaluateBranchFlow,
  evaluatePullRequest,
  loadDecisions,
  loadRegistry,
  validateDecisions,
  validateRegistry,
} from './lib.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const root = process.cwd();
const base = argument('base');
const head = argument('head');
const baseRef = argument('base-ref') ?? `origin/${base}`;
const body = readFileSync(argument('body-file'), 'utf8');
const files = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const requirements = loadRegistry(root);
const decisions = loadDecisions(root);
const result = evaluatePullRequest({ body, files, requirements, decisions });
const errors = [
  ...validateRegistry(requirements),
  ...validateDecisions(decisions),
  ...evaluateBranchFlow({ base, head }),
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
    `Traceability passed: ${result.references.join(', ') || 'no product files changed'}.`,
  );
}
