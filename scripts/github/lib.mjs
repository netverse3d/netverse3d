const LABEL_COLORS = { area: '1d76db', status: 'e4e669' };
const GITHUB_ACTIONS_APP_ID = 15368;
const RELEASE_TAG_PATTERNS = { staging: 'refs/tags/stg-v*', production: 'refs/tags/prod-v*' };

export const REPOSITORY_SETTINGS = {
  has_wiki: false,
  has_issues: true,
  has_projects: true,
  allow_squash_merge: true,
  allow_merge_commit: true,
  allow_rebase_merge: false,
  allow_auto_merge: true,
  delete_branch_on_merge: true,
  squash_merge_commit_title: 'PR_TITLE',
  squash_merge_commit_message: 'BLANK',
  merge_commit_title: 'PR_TITLE',
  merge_commit_message: 'BLANK',
};

function branchRuleset(name, mergeMethods, settings) {
  return {
    name,
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: [`refs/heads/${name}`], exclude: [] } },
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: settings.approvals,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: settings.approvals > 0,
          required_review_thread_resolution: true,
          allowed_merge_methods: mergeMethods,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: settings.requiredChecks.map((context) => ({
            context,
            integration_id: GITHUB_ACTIONS_APP_ID,
          })),
        },
      },
    ],
  };
}

export function buildRulesets(settings) {
  const allReleaseTags = Object.values(RELEASE_TAG_PATTERNS);
  const rulesets = [
    branchRuleset('staging', ['squash', 'merge'], settings),
    branchRuleset('main', ['merge'], settings),
    {
      name: 'release-tags-immutable',
      target: 'tag',
      enforcement: 'active',
      bypass_actors: [],
      conditions: { ref_name: { include: allReleaseTags, exclude: [] } },
      rules: [{ type: 'update' }, { type: 'deletion' }, { type: 'non_fast_forward' }],
    },
  ];
  for (const [environment, pattern] of Object.entries(RELEASE_TAG_PATTERNS)) {
    const appId = settings.releaseAppIds?.[environment];
    if (!appId) continue;
    rulesets.push({
      name: `release-tags-${environment}-by-app`,
      target: 'tag',
      enforcement: 'active',
      bypass_actors: [{ actor_id: appId, actor_type: 'Integration', bypass_mode: 'always' }],
      conditions: { ref_name: { include: [pattern], exclude: [] } },
      rules: [{ type: 'creation' }],
    });
  }
  return rulesets;
}

export function buildLabels(components) {
  const areas = [...components.map((component) => component.id), 'infra', 'docs'];
  return [
    ...areas.map((area) => ({
      name: `area:${area}`,
      color: LABEL_COLORS.area,
      description: `Thuộc ${area}`,
    })),
    { name: 'needs-decision', color: LABEL_COLORS.status, description: 'Cần chốt trước khi làm' },
    { name: 'blocked', color: 'b60205', description: 'Đang bị chặn bởi việc khác' },
    { name: 'waiting-mentor', color: 'd93f0b', description: 'Chờ mentor' },
  ];
}

export function buildEnvironments(settings) {
  return [
    {
      name: 'production-release',
      branchPolicy: [{ name: 'main', type: 'branch' }],
      reviewers: settings.resolvedReviewers,
      preventSelfReview: settings.preventSelfReview,
      canAdminsBypass: false,
    },
    {
      name: 'release-staging',
      branchPolicy: [
        { name: 'staging', type: 'branch' },
        { name: 'hotfix/*', type: 'branch' },
      ],
      reviewers: [],
      preventSelfReview: false,
      canAdminsBypass: false,
    },
    {
      name: 'production',
      branchPolicy: [{ name: 'prod-v*', type: 'tag' }],
      reviewers: [],
      preventSelfReview: false,
      canAdminsBypass: false,
    },
  ];
}

function differenceOfSets(desired, actual, label) {
  return [
    ...desired.filter((key) => !actual.includes(key)).map((key) => `missing ${label} ${key}`),
    ...actual.filter((key) => !desired.includes(key)).map((key) => `unexpected ${label} ${key}`),
  ];
}

export function findEnvironmentDrift(environment, actual, policies) {
  const reviewerRule = actual.protection_rules?.find((rule) => rule.type === 'required_reviewers');
  const actualReviewers = (reviewerRule?.reviewers ?? []).map(
    (item) => `${item.type}:${item.reviewer.id}`,
  );
  const problems = [
    ...differenceOfSets(
      environment.branchPolicy.map((policy) => `${policy.type}:${policy.name}`),
      policies.map((policy) => `${policy.type}:${policy.name}`),
      'policy',
    ),
    ...differenceOfSets(
      environment.reviewers.map((reviewer) => `${reviewer.type}:${reviewer.id}`),
      actualReviewers,
      'reviewer',
    ),
  ];
  if (actual.can_admins_bypass !== environment.canAdminsBypass) {
    problems.push(`can_admins_bypass is ${actual.can_admins_bypass}`);
  }
  if (Boolean(reviewerRule?.prevent_self_review) !== Boolean(environment.preventSelfReview)) {
    problems.push(`prevent_self_review is ${Boolean(reviewerRule?.prevent_self_review)}`);
  }
  return problems.map((problem) => `environment ${environment.name}: ${problem}`);
}

export function findDrift(desired, actual, path = '') {
  if (Array.isArray(desired)) {
    if (!Array.isArray(actual) || actual.length !== desired.length) {
      return [`${path}: expected ${desired.length} items, got ${actual?.length ?? 'none'}`];
    }
    return desired.flatMap((item, index) => findDrift(item, actual[index], `${path}[${index}]`));
  }
  if (desired !== null && typeof desired === 'object') {
    return Object.entries(desired).flatMap(([key, value]) =>
      findDrift(value, actual?.[key], path ? `${path}.${key}` : key),
    );
  }
  return desired === actual
    ? []
    : [`${path}: expected ${JSON.stringify(desired)}, got ${JSON.stringify(actual)}`];
}
