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

const lfsInstall = spawnSync('git', ['lfs', 'install', '--local', '--skip-repo'], {
  stdio: 'inherit',
});
if (lfsInstall.status !== 0) process.exit(lfsInstall.status ?? 1);

const lfsPull = spawnSync('git', ['lfs', 'pull'], { stdio: 'inherit' });
if (lfsPull.status !== 0) {
  console.warn('Could not download the 3D files. Only 3D work needs them: run git lfs pull later.');
}

console.log('Ready. Next: pnpm infra:up, then pnpm verify.');
