import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findOpenApiBreakingChanges,
  findSchemaBreakingChanges,
  isDraft,
  parseContract,
  validateJsonSchema,
  validateOpenApi,
} from './lib.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FOLDERS = ['openapi', 'events', 'realtime'];

function listContracts() {
  return FOLDERS.flatMap((folder) =>
    readdirSync(join(ROOT, folder))
      .filter((name) => name.endsWith('.json') || name.endsWith('.yaml'))
      .map((name) => join(folder, name).replaceAll('\\', '/')),
  );
}

function readAtRef(ref, file) {
  const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const path = relative(repositoryRoot, join(ROOT, file)).replaceAll('\\', '/');
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function listContractsAtRef(ref) {
  const output = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, ...FOLDERS], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return output.split('\n').filter((name) => name.endsWith('.json') || name.endsWith('.yaml'));
}

function compare(file, contract, baseRef) {
  const previousText = readAtRef(baseRef, file);
  if (previousText === null) return [];
  const previous = parseContract(file, previousText);
  if (isDraft(previous)) return [];
  const breaking = file.startsWith('openapi/')
    ? findOpenApiBreakingChanges(previous, contract)
    : findSchemaBreakingChanges(previous, contract);
  return breaking.map(
    (change) => `${file}: breaking change, publish a new version file instead: ${change}`,
  );
}

const baseIndex = process.argv.indexOf('--base');
const baseRef = baseIndex === -1 ? null : process.argv[baseIndex + 1];
const errors = [];
const files = listContracts();

for (const file of files) {
  const contract = parseContract(file, readFileSync(join(ROOT, file), 'utf8'));
  errors.push(
    ...(file.startsWith('openapi/')
      ? validateOpenApi(contract, file)
      : validateJsonSchema(contract, file)),
  );
  if (baseRef) errors.push(...compare(file, contract, baseRef));
}

if (baseRef) {
  for (const file of listContractsAtRef(baseRef)) {
    if (files.includes(file)) continue;
    const previous = parseContract(file, readAtRef(baseRef, file));
    if (!isDraft(previous)) errors.push(`${file}: breaking change, a published file was removed`);
  }
}

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Contracts valid: ${files.length} files.`);
