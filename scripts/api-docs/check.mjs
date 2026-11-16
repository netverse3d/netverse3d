import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPublicDocumentInputs, OUTPUT_DIRECTORY, renderPublicDocuments, ROOT } from './lib.mjs';

const { routes, contracts } = loadPublicDocumentInputs();
const expected = await renderPublicDocuments(routes, contracts);
const actualNames = existsSync(join(ROOT, OUTPUT_DIRECTORY))
  ? readdirSync(join(ROOT, OUTPUT_DIRECTORY)).sort()
  : [];
const expectedNames = Object.keys(expected)
  .map((path) => path.slice(OUTPUT_DIRECTORY.length + 1))
  .sort();
const errors = [];
if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
  errors.push('API docs files differ from the generated list');
}
for (const [path, content] of Object.entries(expected)) {
  const file = join(ROOT, path);
  if (!existsSync(file) || readFileSync(file, 'utf8') !== content) {
    errors.push(`API docs are stale, run pnpm api-docs:render: ${path}`);
  }
}
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log('API docs match contracts and gateway routes.');
