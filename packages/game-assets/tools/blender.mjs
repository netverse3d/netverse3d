import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WINDOWS_INSTALL_ROOT = 'C:\\Program Files\\Blender Foundation';

export function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  if (process.platform === 'win32' && existsSync(WINDOWS_INSTALL_ROOT)) {
    const newest = readdirSync(WINDOWS_INSTALL_ROOT).sort().at(-1);
    if (newest) return join(WINDOWS_INSTALL_ROOT, newest, 'blender.exe');
  }
  return 'blender';
}

export function runBlender(script, args = [], env = {}) {
  const blender = findBlender();
  const run = spawnSync(
    blender,
    ['-b', '--factory-startup', '--python-exit-code', '3', '-P', script, '--', ...args],
    { stdio: 'inherit', env: { ...process.env, ...env } },
  );
  if (run.error) {
    console.error(`Could not start Blender at "${blender}". Set BLENDER_PATH.`);
    return 1;
  }
  return run.status ?? 1;
}
