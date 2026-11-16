import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadRoutes, renderAll, validateRoutes } from './lib.mjs';

const doc = loadRoutes();
const errors = validateRoutes(doc);
if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

for (const [path, content] of Object.entries(renderAll(doc))) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`wrote ${path}`);
}
