import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyLibrary } from './library-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (!target) {
  console.error('Usage: node tools/publish-library.mjs <target folder>');
  process.exit(1);
}

const pointers = copyLibrary(root, resolve(target));
if (pointers.length > 0) {
  console.error(`Fetch these Git LFS files first: ${pointers.join(', ')}`);
  process.exit(1);
}
console.log(`Published the 3D library to ${target}.`);
