import { appendFileSync } from 'node:fs';
import { loadDependencies } from '../catalog/graph.mjs';
import { loadAreas, loadCatalog } from '../catalog/lib.mjs';
import { changedFiles } from '../release/git-facts.mjs';
import { loadUnits, selectUnits } from './lib.mjs';

const root = process.cwd();
const baseIndex = process.argv.indexOf('--base');
const base = baseIndex === -1 ? null : process.argv[baseIndex + 1];

const components = loadCatalog(root);
const units = selectUnits(
  loadUnits(root, components, loadAreas(root)),
  components,
  loadDependencies(root, components),
  changedFiles(base, 'HEAD', root),
).map(({ id, path, package: name }) => ({ id, path, package: name }));

const matrix = JSON.stringify(units);
console.log(`Units to verify: ${matrix}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `units=${matrix}\nany=${units.length > 0}\n`);
}
