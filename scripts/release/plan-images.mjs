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
  selectSourceTag,
  SHARED_PATHS,
  stagingTagsUpTo,
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

const tags = listTags(cwd);
const components = loadCatalog(cwd).map((component) => ({
  ...component,
  hasDockerfile: existsSync(join(cwd, component.path, 'Dockerfile')),
}));
const selected = selectChangedComponents(
  components,
  changedFiles(previousTag(tags, tag), tag, cwd),
);

function withSourceTag(component) {
  if (parsed.environment !== 'production') return { id: component.id, path: component.path };
  const sourceTag = selectSourceTag(
    stagingTagsUpTo(tags, parsed.version),
    (candidate) => changedFiles(candidate, tag, cwd, [component.path, ...SHARED_PATHS]).length > 0,
  );
  if (!sourceTag) fail(`No staging release has the same content as ${tag} for ${component.id}`);
  return { id: component.id, path: component.path, sourceTag };
}

const matrix = JSON.stringify(selected.map(withSourceTag));

console.log(`Components for ${tag}: ${matrix}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `components=${matrix}\n`);
