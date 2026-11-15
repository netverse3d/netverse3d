import { execFileSync, spawnSync } from 'node:child_process';

export const REPOSITORY = 'netverse3d/netverse3d';
export const ORGANIZATION = 'netverse3d';
export const PROJECT_TITLE = 'Netverse 3D';

export function gh(args, input) {
  const output = execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return output.trim();
}

export function ghJson(args, input) {
  const output = gh(args, input);
  return output ? JSON.parse(output) : null;
}

export function api(method, path, body) {
  const args = ['api', '-X', method, path];
  if (body === undefined) return ghJson(args);
  return ghJson([...args, '--input', '-'], JSON.stringify(body));
}

export function graphql(query, variables) {
  return ghJson(
    ['api', 'graphql', '-H', 'GraphQL-Features: issue_fields', '--input', '-'],
    JSON.stringify({ query, variables }),
  ).data;
}

export function listIssues(state = 'all') {
  if (!['all', 'open', 'closed'].includes(state)) {
    throw new Error(`Unsupported issue state: ${state}`);
  }
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = api('GET', `repos/${REPOSITORY}/issues?state=${state}&per_page=100&page=${page}`);
    issues.push(...batch.filter((item) => !item.pull_request));
    if (batch.length < 100) return issues;
  }
}

export function apiStatus(path) {
  const result = spawnSync('gh', ['api', path, '--silent'], { encoding: 'utf8' });
  return result.status === 0;
}
