import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib.mjs';
import { checkRecipes, listRecipes } from './recipes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = checkRecipes(root, loadConfig(root));

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Shop recipes are valid: ${listRecipes(root).length} files.`);
