import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SHARED_ROOT_FILES = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsconfig.base.json',
  '.nvmrc',
];

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

function readManifest(root, component) {
  const file = join(root, component.path, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function loadDependencies(root, components) {
  const manifests = new Map(
    components.map((component) => [component.id, readManifest(root, component)]),
  );
  const idByPackageName = new Map(
    [...manifests]
      .filter(([, manifest]) => manifest?.name)
      .map(([id, manifest]) => [manifest.name, id]),
  );
  return new Map(
    components.map((component) => {
      const manifest = manifests.get(component.id);
      const fromManifest = DEPENDENCY_FIELDS.flatMap((field) =>
        Object.keys(manifest?.[field] ?? {}),
      )
        .map((name) => idByPackageName.get(name))
        .filter((id) => id && id !== component.id);
      const declared = Array.isArray(component.depends_on) ? component.depends_on : [];
      return [component.id, [...new Set([...fromManifest, ...declared])]];
    }),
  );
}

export function findDependencyCycle(dependencies) {
  const finished = new Set();
  const trail = [];
  function visit(id) {
    if (finished.has(id)) return null;
    const start = trail.indexOf(id);
    if (start !== -1) return [...trail.slice(start), id];
    trail.push(id);
    for (const next of dependencies.get(id) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    trail.pop();
    finished.add(id);
    return null;
  }
  for (const id of dependencies.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

function dependentsOf(dependencies) {
  const dependents = new Map();
  for (const [id, needs] of dependencies) {
    for (const needed of needs) {
      dependents.set(needed, [...(dependents.get(needed) ?? []), id]);
    }
  }
  return dependents;
}

export function affectedComponents(components, dependencies, files) {
  if (files === null || files.some((file) => SHARED_ROOT_FILES.includes(file))) return components;
  const dependents = dependentsOf(dependencies);
  const affected = new Set();
  const queue = components
    .filter((component) => files.some((file) => file.startsWith(`${component.path}/`)))
    .map((component) => component.id);
  while (queue.length > 0) {
    const id = queue.shift();
    if (affected.has(id)) continue;
    affected.add(id);
    queue.push(...(dependents.get(id) ?? []));
  }
  return components.filter((component) => affected.has(component.id));
}
