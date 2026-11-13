import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findOpenApiBreakingChanges,
  findSchemaBreakingChanges,
  parseContract,
  validateJsonSchema,
  validateOpenApi,
  versionedPath,
} from './lib.mjs';
import { compareProto, validateProto } from './proto.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const FOLDERS = ['openapi', 'events', 'realtime', 'world', 'grpc'];

function isProto(file) {
  return file.endsWith('.proto');
}

function isContractFile(name) {
  return name.endsWith('.json') || name.endsWith('.yaml') || isProto(name);
}

function listContracts() {
  return FOLDERS.flatMap((folder) => {
    const directory = join(ROOT, folder);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { recursive: true })
      .map((name) => join(folder, name).replaceAll('\\', '/'))
      .filter(isContractFile);
  });
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
  return output.split('\n').filter(isContractFile);
}

function validate(file, text) {
  if (isProto(file)) return validateProto(text, file);
  const contract = parseContract(file, text);
  return file.startsWith('openapi/')
    ? validateOpenApi(contract, file)
    : validateJsonSchema(contract, file);
}

function compare(file, text, baseRef, previousFile = file) {
  const previousText = readAtRef(baseRef, previousFile);
  if (previousText === null) return { changes: [], errors: [] };
  let previous;
  try {
    if (isProto(file)) {
      const { changes, reused } = compareProto(previousText, text);
      return { changes, errors: reused };
    }
    previous = parseContract(file, previousText);
  } catch {
    return {
      changes: ['the previous version could not be read, so changes are not listed'],
      errors: [],
    };
  }
  const contract = parseContract(file, text);
  const changes = file.startsWith('openapi/')
    ? findOpenApiBreakingChanges(previous, contract)
    : findSchemaBreakingChanges(previous, contract);
  return { changes, errors: [] };
}

const baseIndex = process.argv.indexOf('--base');
const baseRef = baseIndex === -1 ? null : process.argv[baseIndex + 1];
const errors = [];
const changes = [];
const files = listContracts();

function record(file, comparison) {
  changes.push(...comparison.changes.map((change) => `${file}: ${change}`));
  errors.push(...comparison.errors.map((error) => `${file}: ${error}`));
}

for (const file of files) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const problems = validate(file, text);
  errors.push(...problems);
  if (baseRef && problems.length === 0) record(file, compare(file, text, baseRef));
}

if (baseRef) {
  for (const file of listContractsAtRef(baseRef)) {
    if (files.includes(file)) continue;
    const movedTo = versionedPath(file);
    if (movedTo && files.includes(movedTo)) {
      const text = readFileSync(join(ROOT, movedTo), 'utf8');
      if (validate(movedTo, text).length === 0) {
        record(movedTo, compare(movedTo, text, baseRef, file));
      }
      continue;
    }
    changes.push(`${file}: the file was removed`);
  }
}

for (const change of changes) console.log(`changed: ${change}`);
for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Contracts valid: ${files.length} files, ${changes.length} changes to review.`);
