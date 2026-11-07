import { readFileSync } from 'node:fs';
import { loadCatalog } from '../catalog/lib.mjs';
import { api, apiStatus, ORGANIZATION, REPOSITORY } from './gh.mjs';
import {
  buildEnvironments,
  buildLabels,
  buildRulesets,
  findDrift,
  findEnvironmentDrift,
  REPOSITORY_SETTINGS,
} from './lib.mjs';

const isCheck = process.argv.includes('--check');
const repositoryPath = `repos/${REPOSITORY}`;
const settings = JSON.parse(readFileSync('.github/settings/repository.json', 'utf8'));

function resolveReviewers() {
  return settings.releaseReviewers.map((reviewer) => {
    if (reviewer.type === 'User') {
      return { type: 'User', id: api('GET', `users/${reviewer.login}`).id };
    }
    return { type: 'Team', id: api('GET', `orgs/${ORGANIZATION}/teams/${reviewer.slug}`).id };
  });
}

function applyRepositorySettings() {
  if (!isCheck) api('PATCH', repositoryPath, REPOSITORY_SETTINGS);
  return findDrift(REPOSITORY_SETTINGS, api('GET', repositoryPath)).map((d) => `repository ${d}`);
}

function applyLabels() {
  const existing = api('GET', `${repositoryPath}/labels?per_page=100`);
  const problems = [];
  for (const label of buildLabels(loadCatalog(process.cwd()))) {
    const current = existing.find((item) => item.name === label.name);
    const drift = current ? findDrift(label, current) : [`missing`];
    if (drift.length === 0) continue;
    if (isCheck) problems.push(...drift.map((d) => `label ${label.name}: ${d}`));
    else if (current) {
      api('PATCH', `${repositoryPath}/labels/${encodeURIComponent(label.name)}`, label);
    } else api('POST', `${repositoryPath}/labels`, label);
  }
  return problems;
}

function normalizeRules(rules) {
  return [...rules].sort((a, b) => a.type.localeCompare(b.type));
}

function listRulesets() {
  return api('GET', `${repositoryPath}/rulesets?per_page=100`) ?? [];
}

function applyRulesets() {
  const problems = [];
  const summaries = listRulesets();
  const desired = buildRulesets(settings);
  for (const ruleset of desired) {
    const summary = summaries.find((item) => item.name === ruleset.name);
    if (!isCheck) {
      if (summary) api('PUT', `${repositoryPath}/rulesets/${summary.id}`, ruleset);
      else api('POST', `${repositoryPath}/rulesets`, ruleset);
    }
    const id = summary?.id ?? listRulesets().find((item) => item.name === ruleset.name)?.id;
    if (!id) {
      problems.push(`ruleset ${ruleset.name}: missing`);
      continue;
    }
    const actual = api('GET', `${repositoryPath}/rulesets/${id}`);
    const drift = findDrift(
      { ...ruleset, rules: normalizeRules(ruleset.rules) },
      { ...actual, rules: normalizeRules(actual.rules ?? []) },
    );
    problems.push(...drift.map((d) => `ruleset ${ruleset.name}: ${d}`));
  }
  const desiredNames = desired.map((ruleset) => ruleset.name);
  for (const summary of summaries) {
    if (!desiredNames.includes(summary.name)) {
      problems.push(`ruleset ${summary.name}: not declared in the settings`);
    }
  }
  return problems;
}

function listPolicies(path) {
  return api('GET', `${path}/deployment-branch-policies`).branch_policies;
}

function applyEnvironment(environment) {
  const path = `${repositoryPath}/environments/${environment.name}`;
  if (!isCheck) {
    api('PUT', path, {
      reviewers: environment.reviewers,
      prevent_self_review: environment.preventSelfReview,
      can_admins_bypass: environment.canAdminsBypass,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    });
    const existing = listPolicies(path);
    for (const policy of environment.branchPolicy) {
      const found = existing.some((item) => item.name === policy.name && item.type === policy.type);
      if (!found) api('POST', `${path}/deployment-branch-policies`, policy);
    }
  }
  if (!apiStatus(path)) return [`environment ${environment.name}: missing`];
  return findEnvironmentDrift(environment, api('GET', path), listPolicies(path));
}

function applyPages() {
  const path = `${repositoryPath}/pages`;
  if (!isCheck) {
    if (apiStatus(path)) api('PUT', path, { build_type: 'workflow' });
    else api('POST', path, { build_type: 'workflow' });
  }
  return apiStatus(path) ? [] : ['pages: not enabled'];
}

const problems = [
  ...applyRepositorySettings(),
  ...applyLabels(),
  ...applyRulesets(),
  ...applyPages(),
];
const resolvedReviewers = resolveReviewers();
for (const environment of buildEnvironments({ ...settings, resolvedReviewers })) {
  problems.push(...applyEnvironment(environment));
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exitCode = 1;
else console.log(isCheck ? 'GitHub settings match.' : 'GitHub settings applied and verified.');
