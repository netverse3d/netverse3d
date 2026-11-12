import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../catalog/lib.mjs';
import { listTags } from './git-facts.mjs';
import { environmentState, renderState } from './lib.mjs';

const cwd = process.cwd();
const deployableIds = loadCatalog(cwd)
  .filter((component) => existsSync(join(cwd, component.path, 'Dockerfile')))
  .map((component) => component.id);
const table = renderState(environmentState(listTags(cwd), deployableIds));

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Released versions\n\n${table}\n`);
}
