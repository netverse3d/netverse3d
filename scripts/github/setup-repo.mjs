import { readFileSync } from 'node:fs';
import { loadCatalog } from '../catalog/lib.mjs';
import { api, apiStatus, REPOSITORY } from './gh.mjs';
import {
  buildEnvironments,
  buildLabels,
  buildRulesets,
  findDrift,
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
    return { type: 'Team', id: api('GET', `orgs/netverse3d/teams/${reviewer.slug}`).id };
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

function applyRulesets() {
  const problems = [];
  const summaries = api('GET', `${repositoryPath}/rulesets?per_page=100`) ?? [];
  for (const ruleset of buildRulesets(settings)) {
    const summary = summaries.find((item) => item.name === ruleset.name);
    if (!isCheck) {
      if (summary) api('PUT', `${repositoryPath}/rulesets/${summary.id}`, ruleset);
      else api('POST', `${repositoryPath}/rulesets`, ruleset);
    }
    const id =
      summary?.id ??
      api('GET', `${repositoryPath}/rulesets?per_page=100`).find(
        (item) => item.name === ruleset.name,
      )?.id;
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
  return problems;
}

function applyEnvironment(environment) {
  const path = `${repositoryPath}/environments/${environment.name}`;
  if (!isCheck) {
    api('PUT', path, {
      reviewers: environment.reviewers,
      prevent_self_review: environment.preventSelfReview ?? false,
      deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
    });
    const existing = api('GET', `${path}/deployment-branch-policies`);
    for (const policy of environment.branchPolicy) {
      const found = existing.branch_policies.some(
        (item) => item.name === policy.name && item.type === policy.type,
      );
      if (!found) api('POST', `${path}/deployment-branch-policies`, policy);
    }
  }
  if (!apiStatus(path)) return [`environment ${environment.name}: missing`];
  const policies = api('GET', `${path}/deployment-branch-policies`).branch_policies;
  const problems = environment.branchPolicy
    .filter((policy) => !policies.some((item) => item.name === policy.name))
    .map((policy) => `environment ${environment.name}: missing policy ${policy.name}`);
  const actual = api('GET', path);
  const reviewerRule = actual.protection_rules?.find((rule) => rule.type === 'required_reviewers');
  const reviewerIds = (reviewerRule?.reviewers ?? []).map((item) => item.reviewer.id);
  for (const reviewer of environment.reviewers) {
    if (!reviewerIds.includes(reviewer.id)) {
      problems.push(`environment ${environment.name}: missing reviewer ${reviewer.id}`);
    }
  }
  if (environment.preventSelfReview && !reviewerRule?.prevent_self_review) {
    problems.push(`environment ${environment.name}: self review is not blocked`);
  }
  return problems;
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
  ...(process.argv.includes('--skip-rulesets') ? [] : applyRulesets()),
  ...applyPages(),
];
const resolvedReviewers = resolveReviewers();
for (const environment of buildEnvironments({ ...settings, resolvedReviewers })) {
  problems.push(...applyEnvironment(environment));
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exitCode = 1;
else console.log(isCheck ? 'GitHub settings match.' : 'GitHub settings applied and verified.');
