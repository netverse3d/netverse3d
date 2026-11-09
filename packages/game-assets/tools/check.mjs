import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAssets } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, skipped } = checkAssets(root, {
  requireContent: process.argv.includes('--require-content'),
});

for (const file of skipped) console.log(`Skipped content check for ${file}: LFS pointer only.`);
for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log('Game assets are valid.');
