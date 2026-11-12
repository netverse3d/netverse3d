import { findDependencyCycle, loadDependencies } from './graph.mjs';
import { checkAllComponents, checkStructure, loadCatalog } from './lib.mjs';

const root = process.cwd();
const catalog = loadCatalog(root);
const errors = [...checkStructure(root), ...checkAllComponents(root)];
const cycle = findDependencyCycle(loadDependencies(root, catalog));
if (cycle) errors.push(`dependency cycle between components: ${cycle.join(' -> ')}`);

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Catalog valid: ${catalog.length} components.`);
