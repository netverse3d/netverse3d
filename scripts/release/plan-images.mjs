import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog } from '../catalog/lib.mjs';
import {
  changedFiles,
  listTags,
  remoteBranchesContaining,
  tagExists,
  treeOf,
} from './git-facts.mjs';
import {
  evaluatePlacement,
  parseTag,
  previousTag,
  selectChangedComponents,
  tagFor,
} from './lib.mjs';

const cwd = process.cwd();
const tag = process.argv[2] ?? '';
const parsed = parseTag(tag);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!parsed) fail(`${tag} is not a valid release tag`);

const peer = tagFor('staging', parsed.version);
const errors = evaluatePlacement({
  ...parsed,
  branches: remoteBranchesContaining(tag, cwd),
  peerExists: tagExists(peer, cwd),
  sameTreeAsPeer: treeOf(tag, cwd) === treeOf(peer, cwd),
});
if (errors.length > 0) fail(errors.join('\n'));

const components = loadCatalog(cwd).map((component) => ({
  ...component,
  hasDockerfile: existsSync(join(cwd, component.path, 'Dockerfile')),
}));
const selected = selectChangedComponents(
  components,
  changedFiles(previousTag(listTags(cwd), tag), tag, cwd),
);
const matrix = JSON.stringify(selected.map(({ id, path }) => ({ id, path })));

console.log(`Components for ${tag}: ${matrix}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `components=${matrix}\n`);
