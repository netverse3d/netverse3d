const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG = /^(stg|prod)-v(.+)$/;
const CHECK_PROVIDER = 'github-actions';

export const SHARED_PATHS = [
  'packages',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  '.nvmrc',
];
export const REQUIRED_CHECKS = ['verify', 'secrets'];
export const TAG_PREFIX = { staging: 'stg', production: 'prod' };

export function tagFor(environment, version) {
  return `${TAG_PREFIX[environment]}-v${version}`;
}

export function parseTag(tag) {
  const match = tag.match(TAG);
  if (!match || !VERSION.test(match[2])) return null;
  return { environment: match[1] === 'stg' ? 'staging' : 'production', version: match[2] };
}

export function evaluatePlacement({ environment, version, branches, peerExists, sameTreeAsPeer }) {
  const tag = tagFor(environment, version);
  const peer = tagFor('staging', version);
  if (environment === 'staging') {
    return branches.includes('staging') ? [] : [`${tag} must be on staging`];
  }
  if (!branches.includes('main')) return [`${tag} must be on main`];
  if (!peerExists) return [`${peer} does not exist; release staging first`];
  if (!sameTreeAsPeer) return [`${tag} content differs from ${peer}; it was not tested`];
  return [];
}

export function evaluateRelease({
  environment,
  version,
  branch,
  refType = 'branch',
  tagExists,
  peerExists,
  sameTree,
}) {
  if (!TAG_PREFIX[environment]) return [`Unknown environment "${environment}"`];
  if (!VERSION.test(version ?? '')) return ['Version must look like 1.4.0'];
  if (refType !== 'branch') return ['Release must run on a branch'];
  const errors = evaluatePlacement({
    environment,
    version,
    branches: [branch],
    peerExists,
    sameTreeAsPeer: sameTree,
  });
  if (tagExists) errors.push(`${tagFor(environment, version)} already exists; use a new version`);
  return errors;
}

export function evaluateChecks(checkRuns, required = REQUIRED_CHECKS) {
  return required.flatMap((name) => {
    const runs = checkRuns.filter(
      (item) => item.name === name && item.app?.slug === CHECK_PROVIDER,
    );
    if (runs.length === 0) return [`Required check "${name}" has not run on this commit`];
    const failed = runs.find((run) => run.conclusion !== 'success');
    if (failed) {
      return [`Required check "${name}" is ${failed.conclusion ?? failed.status}`];
    }
    return [];
  });
}

function versionParts(version) {
  return version.split('.').map(Number);
}

export function compareVersions(left, right) {
  const [a, b] = [versionParts(left), versionParts(right)];
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function previousTag(tags, tag) {
  const current = parseTag(tag);
  if (!current) return null;
  const earlier = tags
    .map((name) => ({ name, parsed: parseTag(name) }))
    .filter(
      ({ parsed }) =>
        parsed?.environment === current.environment &&
        compareVersions(parsed.version, current.version) < 0,
    )
    .sort((a, b) => compareVersions(a.parsed.version, b.parsed.version));
  return earlier.at(-1)?.name ?? null;
}

export function stagingTagsUpTo(tags, version) {
  return tags
    .map((name) => ({ name, parsed: parseTag(name) }))
    .filter(
      ({ parsed }) =>
        parsed?.environment === 'staging' && compareVersions(parsed.version, version) <= 0,
    )
    .sort((a, b) => compareVersions(b.parsed.version, a.parsed.version))
    .map(({ name }) => name);
}

export function selectSourceTag(stagingTagsNewestFirst, hasChangedSince) {
  let source = null;
  for (const tag of stagingTagsNewestFirst) {
    if (hasChangedSince(tag)) break;
    source = tag;
  }
  return source;
}

function isSharedPath(file) {
  return SHARED_PATHS.some((path) => file === path || file.startsWith(`${path}/`));
}

export function selectChangedComponents(components, files) {
  const deployable = components.filter((component) => component.hasDockerfile);
  if (files === null || files.some(isSharedPath)) return deployable;
  return deployable.filter((component) =>
    files.some((file) => file.startsWith(`${component.path}/`)),
  );
}
