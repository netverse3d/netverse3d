import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { COMPONENT_ROOTS, loadCatalog } from '../catalog/lib.mjs';
import { gitLines } from '../lib/git.mjs';
import { checkUsages, findFlagUsages, validateFlags } from './lib.mjs';

const SCANNED_FILE = /(\.([cm]?[jt]sx?|go|py)|\.env\.example)$/;

const root = process.cwd();
const flags = parse(readFileSync(join(root, 'docs/flags.yaml'), 'utf8'))?.flags ?? [];
const componentIds = loadCatalog(root).map((component) => component.id);
const today = new Date().toISOString().slice(0, 10);
const files = gitLines(['ls-files', '--', ...COMPONENT_ROOTS], root)
  .filter((path) => SCANNED_FILE.test(path))
  .map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') }));

const errors = [
  ...validateFlags(flags, componentIds, today),
  ...checkUsages(findFlagUsages(files), flags),
];

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Flags valid: ${flags.length} declared, ${files.length} files scanned.`);
