import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishExport } from './lib.mjs';

const WINDOWS_INSTALL_ROOT = 'C:\\Program Files\\Blender Foundation';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function findBlender() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  if (process.platform === 'win32' && existsSync(WINDOWS_INSTALL_ROOT)) {
    const newest = readdirSync(WINDOWS_INSTALL_ROOT).sort().at(-1);
    if (newest) return join(WINDOWS_INSTALL_ROOT, newest, 'blender.exe');
  }
  return 'blender';
}

const blender = findBlender();
const run = spawnSync(
  blender,
  ['-b', '--factory-startup', '--python-exit-code', '3', '-P', join(root, 'tools/export.py')],
  { stdio: 'inherit' },
);
if (run.error) {
  console.error(`Could not start Blender at "${blender}". Set BLENDER_PATH.`);
  process.exit(1);
}
if (run.status !== 0) process.exit(run.status ?? 1);

const errors = finishExport(root);
for (const error of errors) console.error(error);
if (errors.length > 0) process.exit(1);
console.log('Exported and validated.');
