import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'out', 'build', 'coverage']);
const IMPORT_PATTERNS = [
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /(?:^|[^\w$.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export function importedModules(source) {
  const found = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) found.push({ at: match.index, name: match[1] });
  }
  return found.sort((first, second) => first.at - second.at).map((entry) => entry.name);
}

function layerFiles(root, directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
        files.push(...layerFiles(root, path));
      }
    } else if (SOURCE_FILE.test(entry.name)) {
      files.push(path);
    }
  }
  return files.sort();
}

function repositoryPath(file, specifier, aliases) {
  for (const [alias, target] of Object.entries(aliases)) {
    if (specifier.startsWith(alias)) return posix.normalize(target + specifier.slice(alias.length));
  }
  if (!specifier.startsWith('.')) return null;
  return posix.normalize(posix.join(posix.dirname(file), specifier));
}

function isInside(path, directory) {
  return path === directory || path.startsWith(`${directory}/`);
}

function brokenReason(file, specifier, rule) {
  const path = repositoryPath(file, specifier, rule.aliases ?? {});
  for (const { packages = [], paths = [], reason } of rule.forbidden) {
    if (path === null && packages.some((name) => isInside(specifier, name))) return reason;
    if (path !== null && paths.some((directory) => isInside(path, directory))) return reason;
  }
  return null;
}

export function findViolations(root, rules) {
  const violations = [];
  for (const rule of rules) {
    for (const file of layerFiles(root, rule.layer)) {
      for (const specifier of importedModules(readFileSync(join(root, file), 'utf8'))) {
        const reason = brokenReason(file, specifier, rule);
        if (reason) violations.push(`${file} imports '${specifier}': ${reason}`);
      }
    }
  }
  return violations;
}
