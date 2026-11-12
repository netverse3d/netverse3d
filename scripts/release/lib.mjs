import { dependencyClosure, SHARED_ROOT_FILES } from '../catalog/graph.mjs';

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG = /^([a-z0-9][a-z0-9-]*)\/(stg|prod)-v(.+)$/;
const CHECK_PROVIDER = 'github-actions';

export const REQUIRED_CHECKS = ['verify', 'secrets'];
export const TAG_PREFIX = { staging: 'stg', production: 'prod' };

export function tagFor(component, environment, version) {
  return `${component}/${TAG_PREFIX[environment]}-v${version}`;
}

export function parseTag(tag) {
  const match = tag.match(TAG);
  if (!match || !VERSION.test(match[3])) return null;
  return {
    component: match[1],
    environment: match[2] === 'stg' ? 'staging' : 'production',
    version: match[3],
  };
}

export function evaluatePlacement({
  component,
  environment,
  version,
  branches,
  peerExists,
  sameContentAsPeer,
}) {
  const tag = tagFor(component, environment, version);
  const peer = tagFor(component, 'staging', version);
  if (environment === 'staging') {
    return branches.includes('staging') ? [] : [`${tag} must be on staging`];
  }
  if (!branches.includes('main')) return [`${tag} must be on main`];
  if (!peerExists) return [`${peer} does not exist; release staging first`];
  if (!sameContentAsPeer) {
    return [`${tag}: content of ${component} differs from ${peer}; it was not tested`];
  }
  return [];
}

function versionParts(version) {
  return version.split('.').map(Number);
}

export function compareVersions(left, right) {
  const [a, b] = [versionParts(left), versionParts(right)];
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

export function evaluateRelease({
  component,
  deployable,
  environment,
  version,
  branch,
  refType = 'branch',
  tagExists,
  peerExists,
  sameContent,
  previousVersion = null,
}) {
  if (!component) return ['Component is required, for example identity'];
  if (!deployable) return [`"${component}" is not a deployable component in docs/catalog.yaml`];
  if (!TAG_PREFIX[environment]) return [`Unknown environment "${environment}"`];
  if (!VERSION.test(version ?? '')) return ['Version must look like 1.4.0'];
  if (refType !== 'branch') return ['Release must run on a branch'];
  const errors = evaluatePlacement({
    component,
    environment,
    version,
    branches: [branch],
    peerExists,
    sameContentAsPeer: sameContent,
  });
  const tag = tagFor(component, environment, version);
  if (tagExists) {
    errors.push(`${tag} already exists; use a new version`);
  } else if (previousVersion && compareVersions(version, previousVersion) <= 0) {
    errors.push(
      `${version} must be greater than ${previousVersion}, the latest ${environment} release of ${component}`,
    );
  }
  return errors;
}

export function latestVersion(tags, component, environment) {
  const versions = tags
    .map(parseTag)
    .filter((parsed) => parsed?.component === component && parsed.environment === environment)
    .map((parsed) => parsed.version)
    .sort(compareVersions);
  return versions.at(-1) ?? null;
}

export function contentPaths(component, components, dependencies) {
  const pathById = new Map(components.map((item) => [item.id, item.path]));
  return [
    component.path,
    ...dependencyClosure(component.id, dependencies).map((id) => pathById.get(id)),
    ...SHARED_ROOT_FILES,
  ];
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
