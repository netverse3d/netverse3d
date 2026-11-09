import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { findMissingTools } from './infra/lib.mjs';

const REQUIRED_TOOLS = ['git', 'git-lfs', 'node', 'pnpm', 'docker'];
const shell = process.platform === 'win32';

function isInstalled(tool) {
  return spawnSync(tool, ['--version'], { stdio: 'ignore', shell }).status === 0;
}

const missing = findMissingTools(isInstalled, REQUIRED_TOOLS);
if (missing.length > 0) {
  console.error(`Install these tools first: ${missing.join(', ')}`);
  process.exit(1);
}

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example.');
}

const install = spawnSync('pnpm', ['install', '--frozen-lockfile'], { stdio: 'inherit', shell });
if (install.status !== 0) process.exit(install.status ?? 1);

const hooks = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
if (hooks.status !== 0) process.exit(hooks.status ?? 1);

for (const args of [
  ['lfs', 'install', '--local', '--skip-repo'],
  ['lfs', 'pull'],
]) {
  const lfs = spawnSync('git', args, { stdio: 'inherit' });
  if (lfs.status !== 0) process.exit(lfs.status ?? 1);
}

console.log('Ready. Next: pnpm infra:up, then pnpm verify.');
