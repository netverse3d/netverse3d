import { checkAllComponents, checkStructure, loadCatalog } from './lib.mjs';

const root = process.cwd();
const errors = [...checkStructure(root), ...checkAllComponents(root)];

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Catalog valid: ${loadCatalog(root).length} components.`);
