import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const COMPONENT_ROOTS = ['apps', 'services', 'workers', 'packages'];
export const PROVENANCE_VALUES = ['none', 'original', 'cleared'];

const METADATA_FILES = new Set(['README.md', 'component.yaml']);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage']);
const DECISION_ID = /^ADR-\d{4}$/;
const MANIFESTS = ['package.json', 'go.mod', 'pyproject.toml'];
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?|_test\.go|^test_.+\.py)$/;
const HEALTH_ENDPOINT = /["'`/]healthz["'`]?/;
const SOURCE_FILE = /\.([cm]?[jt]sx?|go|py)$/;
const README_MILESTONE = /^-\s*Milestone:\s*(M\d+)\s*$/m;

function readCatalogFile(root) {
  return parse(readFileSync(join(root, 'docs/catalog.yaml'), 'utf8')) ?? {};
}

export function loadCatalog(root) {
  return readCatalogFile(root).components ?? [];
}

export function loadAreas(root) {
  return readCatalogFile(root).areas ?? [];
}

function withoutIgnoredPaths(directory, paths) {
  if (paths.length === 0) return paths;
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd: directory,
    input: paths.join('\n'),
    encoding: 'utf8',
  });
  if (result.status !== 0) return paths;
  const ignored = new Set(result.stdout.split('\n').filter(Boolean));
  return paths.filter((path) => !ignored.has(path));
}

export function listTopLevelDirectories(root) {
  const names = readdirSync(root).filter(
    (name) =>
      !name.startsWith('.') &&
      !IGNORED_DIRECTORIES.has(name) &&
      statSync(join(root, name)).isDirectory(),
  );
  return withoutIgnoredPaths(root, names);
}

function checkAreas(root) {
  const errors = [];
  const seen = new Set();
  for (const area of loadAreas(root)) {
    const label = area.path ?? '(missing path)';
    if (!area.path) {
      errors.push(`${label}: area is missing path`);
      continue;
    }
    if (seen.has(area.path)) errors.push(`${label}: duplicate area`);
    seen.add(area.path);
    if (!area.summary) errors.push(`${label}: area is missing summary`);
    if (!existsSync(join(root, area.path))) {
      errors.push(`${label}: listed in areas but the directory is missing`);
    }
  }
  for (const directory of listTopLevelDirectories(root)) {
    if (!seen.has(directory)) {
      errors.push(`${directory}: top-level directory is not in areas of docs/catalog.yaml`);
    }
  }
  return errors;
}

function checkDependencies(component, ids) {
  const label = component.path ?? component.id;
  if (component.depends_on === undefined) return [];
  if (!Array.isArray(component.depends_on)) return [`${label}: depends_on must be a list`];
  return component.depends_on.flatMap((id) => {
    if (id === component.id) return [`${label}: depends_on cannot name itself`];
    if (!ids.has(id)) return [`${label}: depends_on "${id}" is not a component`];
    return [];
  });
}

export function listComponentDirectories(root) {
  const directories = [];
  for (const parent of COMPONENT_ROOTS) {
    const absolute = join(root, parent);
    if (!existsSync(absolute)) continue;
    for (const name of readdirSync(absolute)) {
      if (statSync(join(absolute, name)).isDirectory()) directories.push(`${parent}/${name}`);
    }
  }
  return directories;
}

function checkReadmeMilestone(root, component) {
  const readme = join(root, component.path, 'README.md');
  if (!existsSync(readme)) return [];
  const stated = readFileSync(readme, 'utf8').match(README_MILESTONE)?.[1];
  if (!stated || stated === component.milestone) return [];
  return [
    `${component.path}: README.md says milestone ${stated} but the catalog says ${component.milestone}`,
  ];
}

export function checkStructure(root) {
  const errors = [];
  const catalog = loadCatalog(root);
  const paths = new Set(catalog.map((component) => component.path));
  const knownIds = new Set(catalog.map((component) => component.id));
  const ids = new Set();
  for (const component of catalog) {
    if (ids.has(component.id)) errors.push(`${component.id}: duplicate component id`);
    ids.add(component.id);
    for (const field of ['id', 'path', 'kind', 'stack', 'summary', 'milestone']) {
      if (!component[field]) errors.push(`${component.path ?? component.id}: missing ${field}`);
    }
    if (!component.path) continue;
    if (!existsSync(join(root, component.path))) {
      errors.push(`${component.path}: listed in the catalog but the directory is missing`);
      continue;
    }
    for (const file of ['README.md', 'component.yaml']) {
      if (!existsSync(join(root, component.path, file))) {
        errors.push(`${component.path}: missing ${file}`);
      }
    }
    errors.push(...checkReadmeMilestone(root, component));
  }
  for (const component of catalog) errors.push(...checkDependencies(component, knownIds));
  for (const directory of listComponentDirectories(root)) {
    if (!paths.has(directory)) errors.push(`${directory}: directory is not in docs/catalog.yaml`);
  }
  errors.push(...checkAreas(root));
  return errors;
}

function walkFiles(directory, base = '') {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(name)) continue;
    const absolute = join(directory, name);
    const relative = base ? `${base}/${name}` : name;
    if (statSync(absolute).isDirectory()) files.push(...walkFiles(absolute, relative));
    else files.push(relative);
  }
  return files;
}

function requiredFilesFor(kind) {
  if (kind === 'service') return ['Dockerfile', '.env.example'];
  if (kind === 'worker') return ['Dockerfile', '.env.example'];
  if (kind === 'app') return ['Dockerfile'];
  return [];
}

function decisionExists(root, id) {
  const directory = join(root, 'docs/decisions');
  return existsSync(directory) && readdirSync(directory).some((name) => name.startsWith(`${id}-`));
}

export function checkComponent(root, component) {
  const directory = join(root, component.path);
  const files = withoutIgnoredPaths(directory, walkFiles(directory));
  const implementation = files.filter((file) => !METADATA_FILES.has(file));
  const errors = [];
  const metadataPath = join(directory, 'component.yaml');
  if (!existsSync(metadataPath)) return [`${component.path}: missing component.yaml`];
  const metadata = parse(readFileSync(metadataPath, 'utf8')) ?? {};
  const label = component.path;

  if (!PROVENANCE_VALUES.includes(metadata.provenance)) {
    errors.push(`${label}: provenance must be one of ${PROVENANCE_VALUES.join(', ')}`);
  }
  if (metadata.provenance === 'cleared' && !DECISION_ID.test(metadata.provenance_ref ?? '')) {
    errors.push(`${label}: provenance "cleared" needs provenance_ref pointing to an ADR`);
  } else if (metadata.provenance === 'cleared' && !decisionExists(root, metadata.provenance_ref)) {
    errors.push(`${label}: ${metadata.provenance_ref} does not exist in docs/decisions`);
  }
  if (implementation.length === 0) return errors;

  if (metadata.provenance === 'none') {
    errors.push(`${label}: has code but provenance is "none"; declare where the code comes from`);
  }
  if (!MANIFESTS.some((manifest) => files.includes(manifest))) {
    errors.push(`${label}: missing a manifest (${MANIFESTS.join(', ')})`);
  }
  for (const required of requiredFilesFor(component.kind)) {
    if (!files.includes(required)) errors.push(`${label}: missing ${required}`);
  }
  if (!files.some((file) => TEST_FILE.test(file.split('/').pop()))) {
    errors.push(`${label}: has no test files`);
  }
  if (component.kind === 'service') {
    if (!implementation.some((file) => file.endsWith('openapi.yaml'))) {
      errors.push(`${label}: missing openapi.yaml`);
    }
    const sources = implementation.filter((file) => SOURCE_FILE.test(file));
    const hasHealth = sources.some((file) =>
      HEALTH_ENDPOINT.test(readFileSync(join(directory, file), 'utf8')),
    );
    if (!hasHealth) errors.push(`${label}: no /healthz endpoint found`);
  }
  return errors;
}

export function checkAllComponents(root) {
  return loadCatalog(root).flatMap((component) =>
    existsSync(join(root, component.path)) ? checkComponent(root, component) : [],
  );
}
