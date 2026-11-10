import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBlender } from './blender.mjs';
import { finishExport } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const status = runBlender(join(root, 'tools/export.py'));
if (status !== 0) process.exit(status);

const errors = finishExport(root);
for (const error of errors) console.error(error);
if (errors.length > 0) process.exit(1);
console.log('Exported and validated.');
