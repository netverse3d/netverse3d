import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { affectedComponents, SHARED_ROOT_FILES } from '../catalog/graph.mjs';

export const CI_SHARED_FILES = ['eslint.config.mjs', '.github/workflows/ci.yml'];

const REQUIRED_JOBS = ['repo', 'plan', 'unit'];

function manifestAt(root, path) {
  const file = join(root, path, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function unitAt(root, id, path, standalone) {
  const manifest = manifestAt(root, path);
  return {
    id,
    path,
    package: manifest?.name ?? null,
    e2e: Boolean(manifest?.scripts?.['test:e2e']),
    ...(standalone ? { standalone: true } : {}),
  };
}

export function loadUnits(root, components, areas) {
  return [
    ...components.map((component) => unitAt(root, component.id, component.path, false)),
    ...areas.map((area) => unitAt(root, area.path, area.path, true)),
  ].filter((unit) => unit.package);
}

export function selectUnits(units, components, dependencies, files) {
  const everything =
    files === null ||
    files.some((file) => SHARED_ROOT_FILES.includes(file) || CI_SHARED_FILES.includes(file));
  if (everything) return units;
  const affected = new Set(
    affectedComponents(components, dependencies, files).map((component) => component.id),
  );
  return units.filter((unit) =>
    unit.standalone
      ? files.some((file) => file.startsWith(`${unit.path}/`))
      : affected.has(unit.id),
  );
}

export function concludeRun(needs) {
  const hasUnits = needs.plan?.outputs?.any === 'true';
  return REQUIRED_JOBS.flatMap((job) => {
    const result = needs[job]?.result ?? 'missing';
    if (result === 'success') return [];
    if (job === 'unit' && result === 'skipped' && !hasUnits && needs.plan?.result === 'success') {
      return [];
    }
    return [`${job}: ${result}`];
  });
}

export function findUnitsWithoutJob(components, units, stackManifestOf) {
  const covered = new Set(units.map((unit) => unit.id));
  return components.flatMap((component) => {
    if (covered.has(component.id)) return [];
    const manifest = stackManifestOf(component);
    return manifest ? [`${component.id}: has ${manifest} but CI has no job for it yet`] : [];
  });
}
