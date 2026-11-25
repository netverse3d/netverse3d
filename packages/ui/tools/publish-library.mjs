import { resolve } from 'node:path';
import { copyLibrary } from './library-files.mjs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node tools/publish-library.mjs <target folder>');
  process.exit(1);
}
copyLibrary(resolve(target));
console.log(`Published the interface library to ${target}.`);
