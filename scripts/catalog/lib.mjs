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

export function loadCatalog(root) {
  return parse(readFileSync(join(root, 'docs/catalog.yaml'), 'utf8'))?.components ?? [];
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

export function checkStructure(root) {
  const errors = [];
  const catalog = loadCatalog(root);
  const paths = new Set(catalog.map((component) => component.path));
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
  }
  for (const directory of listComponentDirectories(root)) {
    if (!paths.has(directory)) errors.push(`${directory}: directory is not in docs/catalog.yaml`);
  }
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

function withoutIgnoredFiles(directory, files) {
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd: directory,
    input: files.join('
'),
    encoding: 'utf8',
  });
  if (result.status !== 0) return files;
  const ignored = new Set(result.stdout.split('
').filter(Boolean));
  return files.filter((file) => !ignored.has(file));
}

function requiredFilesFor(kind) {
  if (kind === 'service') return ['Dockerfile', '.env.example'];
  if (kind === 'worker') return ['Dockerfile', '.env.example'];
  if (kind === 'app') return ['Dockerfile'];
  return [];
}

export function checkComponent(root, component) {
  const directory = join(root, component.path);
  const files = withoutIgnoredFiles(directory, walkFiles(directory));
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
