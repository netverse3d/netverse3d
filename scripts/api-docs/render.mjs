import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadPublicDocumentInputs, renderPublicDocuments, ROOT } from './lib.mjs';

const { routes, contracts } = loadPublicDocumentInputs();
for (const [path, content] of Object.entries(await renderPublicDocuments(routes, contracts))) {
  const output = join(ROOT, path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content);
  console.log(`wrote ${path}`);
}
