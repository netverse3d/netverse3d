import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, posix, resolve } from 'node:path';

const SKIPPED_DIRECTORIES = new Set(['.git', 'build', 'coverage', 'dist', 'node_modules', 'out']);

function normalizedPath(path) {
  return posix.normalize(path.replaceAll('\\', '/'));
}

function skipRulesOf(skip) {
  if (skip === undefined || skip === null) return [];
  if (Array.isArray(skip)) return skip;
  if (skip instanceof Set) return [...skip];
  return [skip];
}

function shouldSkip(path, rules) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return rules.some((rule) => {
    if (typeof rule === 'function') return rule(path);
    if (rule instanceof RegExp) {
      rule.lastIndex = 0;
      return rule.test(path);
    }
    if (typeof rule !== 'string')
      throw new TypeError('skip rules must be paths, regular expressions, or functions');
    const target = normalizedPath(rule).replace(/\/$/, '');
    return path === target || path.startsWith(`${target}/`) || name === target;
  });
}

function rootOptions(root) {
  if (typeof root === 'string') return { path: root, recursive: true };
  if (!root || typeof root.path !== 'string')
    throw new TypeError('each root must be a path or a path object');
  return { path: root.path, recursive: root.recursive !== false };
}

export function listSourceFiles(roots, { extensions = [], skip } = {}) {
  if (!Array.isArray(roots)) throw new TypeError('roots must be an array');
  const extensionSet = new Set(extensions);
  const skipRules = skipRulesOf(skip);
  const files = new Set();

  for (const root of roots) {
    const { path, recursive } = rootOptions(root);
    const absoluteRoot = resolve(path);
    const displayRoot = normalizedPath(isAbsolute(path) ? absoluteRoot : path);
    if (shouldSkip(displayRoot, skipRules)) continue;
    if (!existsSync(absoluteRoot)) throw new Error(`source root does not exist: ${displayRoot}`);
    if (!statSync(absoluteRoot).isDirectory())
      throw new Error(`source root is not a directory: ${displayRoot}`);

    function walkSourceTree(absoluteDirectory, displayDirectory) {
      const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = join(absoluteDirectory, entry.name);
        const displayPath = normalizedPath(posix.join(displayDirectory, entry.name));
        if (entry.isDirectory()) {
          if (
            recursive &&
            !SKIPPED_DIRECTORIES.has(entry.name) &&
            !shouldSkip(displayPath, skipRules)
          ) {
            walkSourceTree(absolutePath, displayPath);
          }
        } else if (extensionSet.has(extname(entry.name)) && !shouldSkip(displayPath, skipRules)) {
          files.add(displayPath);
        }
      }
    }

    walkSourceTree(absoluteRoot, displayRoot);
  }

  return [...files].sort();
}

function globalPattern(pattern) {
  if (!(pattern instanceof RegExp))
    throw new TypeError('each scan rule must use a regular expression');
  const flags = `${pattern.flags.replaceAll('g', '').replaceAll('y', '')}g`;
  return new RegExp(pattern.source, flags);
}

function ruleName(rule) {
  const name = rule.rule ?? rule.id;
  if (typeof name !== 'string' || name.length === 0)
    throw new TypeError('each scan rule needs a name');
  return name;
}

function allowedMatches(allowlist) {
  return new Set(
    allowlist.map((entry) => {
      if (
        typeof entry.file !== 'string' ||
        typeof entry.rule !== 'string' ||
        typeof entry.reason !== 'string' ||
        entry.reason.trim().length === 0
      ) {
        throw new TypeError('allowlist entries need file, rule, and reason');
      }
      return JSON.stringify([normalizedPath(entry.file), entry.rule]);
    }),
  );
}

export function scanSources(files, rules, allowlist = []) {
  if (!Array.isArray(files) || !Array.isArray(rules) || !Array.isArray(allowlist)) {
    throw new TypeError('files, rules, and allowlist must be arrays');
  }
  const allowed = allowedMatches(allowlist);
  const matches = [];

  for (const file of files) {
    const path = normalizedPath(file);
    const source = readFileSync(file, 'utf8');
    for (const rule of rules) {
      const name = ruleName(rule);
      if (allowed.has(JSON.stringify([path, name]))) continue;
      const pattern = globalPattern(rule.pattern);
      for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
        const line = source.slice(0, match.index).split('\n').length;
        matches.push({ file: path, line, rule: name, match: match[0] });
        if (match[0].length === 0) pattern.lastIndex += 1;
      }
    }
  }

  return matches;
}
