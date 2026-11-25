import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkModuleCss, checkScreenSource } from './lib.mjs';

const root = process.cwd();
const SCREEN_ROOTS = ['apps/web-3d/app', 'apps/web-3d/src/ui', 'apps/admin/src'];
const registry = JSON.parse(
  readFileSync(join(root, 'packages/ui/components/registry.json'), 'utf8'),
);
const registeredNames = new Set(
  registry.components.filter((entry) => entry.react).map((entry) => entry.react),
);

function filesUnder(folder) {
  const absolute = join(root, folder);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true })
    .map(String)
    .map((name) => join(absolute, name));
}

const violations = [];
for (const folder of SCREEN_ROOTS) {
  for (const file of filesUnder(folder)) {
    const path = relative(root, file).split('\\').join('/');
    if (file.endsWith('.tsx')) {
      violations.push(...checkScreenSource(readFileSync(file, 'utf8'), path, registeredNames));
    } else if (file.endsWith('.module.css')) {
      violations.push(...checkModuleCss(readFileSync(file, 'utf8'), path));
    }
  }
}

for (const violation of violations) console.error(violation);
if (violations.length > 0) {
  console.error('Screens compose registered components only. See ADR-0041.');
  process.exitCode = 1;
} else {
  console.log(`Interface screens valid: ${registeredNames.size} registered components.`);
}
