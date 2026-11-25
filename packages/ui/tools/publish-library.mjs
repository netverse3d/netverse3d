import { resolve } from 'node:path';
import { buildLibrary } from './library-files.mjs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node tools/publish-library.mjs <target folder>');
  process.exit(1);
}
await buildLibrary(resolve(target));
console.log(`Published the interface library to ${target}.`);
