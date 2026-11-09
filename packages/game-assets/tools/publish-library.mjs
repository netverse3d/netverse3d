import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyLibrary } from './library-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (!target) {
  console.error('Usage: node tools/publish-library.mjs <target folder>');
  process.exit(1);
}

const unusable = copyLibrary(root, resolve(target));
if (unusable.length > 0) {
  console.error(`These models are missing or not downloaded: ${unusable.join(', ')}`);
  process.exit(1);
}
console.log(`Published the 3D library to ${target}.`);
