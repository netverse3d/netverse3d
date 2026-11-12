import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadDependencies } from '../catalog/graph.mjs';
import { loadAreas, loadCatalog } from '../catalog/lib.mjs';
import { changedFiles } from '../release/git-facts.mjs';
import { findUnitsWithoutJob, loadUnits, selectUnits } from './lib.mjs';

const root = process.cwd();
const baseIndex = process.argv.indexOf('--base');
const base = baseIndex === -1 ? null : process.argv[baseIndex + 1];

const OTHER_STACK_MANIFESTS = ['go.mod', 'pyproject.toml', 'requirements.txt'];

const components = loadCatalog(root);
const allUnits = loadUnits(root, components, loadAreas(root));
const uncovered = findUnitsWithoutJob(
  components,
  allUnits,
  (component) =>
    OTHER_STACK_MANIFESTS.find((name) => existsSync(join(root, component.path, name))) ?? null,
);
if (uncovered.length > 0) {
  for (const message of uncovered) console.error(message);
  process.exit(1);
}

const units = selectUnits(
  allUnits,
  components,
  loadDependencies(root, components),
  changedFiles(base, 'HEAD', root),
).map(({ id, path, package: name, e2e }) => ({ id, path, package: name, e2e }));

const matrix = JSON.stringify(units);
console.log(`Units to verify: ${matrix}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `units=${matrix}\nany=${units.length > 0}\n`);
}
