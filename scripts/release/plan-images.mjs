import { appendFileSync } from 'node:fs';
import { comparePeer, describeComponent } from './component.mjs';
import { remoteBranchesContaining } from './git-facts.mjs';
import { evaluatePlacement, parseTag } from './lib.mjs';

const cwd = process.cwd();
const tag = process.argv[2] ?? '';
const parsed = parseTag(tag);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!parsed) fail(`${tag} is not a valid release tag`);

const { entry, deployable, paths } = describeComponent(cwd, parsed.component);
if (!deployable) fail(`"${parsed.component}" is not a deployable component in docs/catalog.yaml`);

const { peer, peerExists, sameContent } = comparePeer(
  cwd,
  parsed.component,
  parsed.version,
  tag,
  paths,
);
const errors = evaluatePlacement({
  ...parsed,
  branches: remoteBranchesContaining(tag, cwd),
  peerExists,
  sameContentAsPeer: sameContent,
});
if (errors.length > 0) fail(errors.join('\n'));

const planned = { id: entry.id, path: entry.path, version: parsed.version };
if (parsed.environment === 'production') planned.sourceTag = peer;
const matrix = JSON.stringify([planned]);

console.log(`Components for ${tag}: ${matrix}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `components=${matrix}\n`);
