import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { loadAreas, loadCatalog } from '../catalog/lib.mjs';
import { loadDecisions, loadRegistry } from '../trace/lib.mjs';
import {
  renderAreaIndex,
  renderCatalog,
  renderDecisions,
  renderRequirements,
  renderRoadmap,
} from './render.mjs';

const AREAS_WITH_OWN_INDEX = new Set(['docs']);

const root = process.cwd();
const isCheck = process.argv.includes('--check');

const milestones = parse(
  readFileSync(join(root, 'docs/requirements/milestones.yaml'), 'utf8'),
).milestones;
const requirements = loadRegistry(root);
const decisions = loadDecisions(root).map((decision) => {
  const text = readFileSync(join(root, 'docs/decisions', decision.file), 'utf8');
  const title = text.split('\n')[0].replace(/^#\s*ADR-\d{4}:\s*/, '');
  return { ...decision, title };
});

const components = loadCatalog(root);
const areas = loadAreas(root);

const pages = {
  'docs/requirements/index.md': renderRequirements(requirements, milestones),
  'docs/decisions/index.md': renderDecisions(decisions),
  'docs/wiki/team/roadmap.md': renderRoadmap(requirements, milestones),
  'docs/wiki/engineering/components.md': renderCatalog(components, areas),
  ...Object.fromEntries(
    areas
      .filter((area) => !AREAS_WITH_OWN_INDEX.has(area.path))
      .map((area) => [`${area.path}/README.md`, renderAreaIndex(area, components)]),
  ),
};

function readExisting(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const stale = [];
for (const [path, content] of Object.entries(pages)) {
  const file = join(root, path);
  if (readExisting(file)?.replaceAll('\r\n', '\n') === content) continue;
  if (isCheck) {
    stale.push(path);
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

if (stale.length > 0) {
  console.error(`Generated pages are out of date: ${stale.join(', ')}`);
  console.error('Run: pnpm docs:generate');
  process.exitCode = 1;
}
