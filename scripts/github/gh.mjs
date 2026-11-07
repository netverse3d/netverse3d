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

export function apiStatus(path) {
  const result = spawnSync('gh', ['api', path, '--silent'], { encoding: 'utf8' });
  return result.status === 0;
}
