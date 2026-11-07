import { appendFileSync, readFileSync } from 'node:fs';
import { tagExists, treeOf } from './git-facts.mjs';
import { evaluateChecks, evaluateRelease, tagFor } from './lib.mjs';
import { argument } from '../lib/cli.mjs';

const cwd = process.cwd();
const environment = argument('environment');
const version = argument('version');
const branch = argument('branch');
const checksFile = argument('checks-file');
const tag = tagFor(environment, version);
const peer = tagFor('staging', version);

const errors = evaluateRelease({
  environment,
  version,
  branch,
  tagExists: tagExists(tag, cwd),
  peerExists: tagExists(peer, cwd),
  sameTree: treeOf('HEAD', cwd) === treeOf(peer, cwd),
});
if (checksFile) {
  errors.push(...evaluateChecks(JSON.parse(readFileSync(checksFile, 'utf8'))));
}

for (const error of errors) console.error(error);
if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`Ready to release ${tag}.`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
}
