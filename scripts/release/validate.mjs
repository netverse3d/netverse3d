import { appendFileSync, readFileSync } from 'node:fs';
import { argument } from '../lib/cli.mjs';
import { comparePeer, describeComponent } from './component.mjs';
import { listTags, tagExists } from './git-facts.mjs';
import { evaluateChecks, evaluateRelease, latestVersion, TAG_PREFIX, tagFor } from './lib.mjs';

const cwd = process.cwd();
const component = argument('component');
const environment = argument('environment');
const version = argument('version');
const branch = argument('branch');
const checksFile = argument('checks-file');

const { deployable, paths } = describeComponent(cwd, component);
const known = deployable && Boolean(TAG_PREFIX[environment]);
const { peerExists, sameContent } = known
  ? comparePeer(cwd, component, version, 'HEAD', paths)
  : { peerExists: false, sameContent: false };

const errors = evaluateRelease({
  component,
  deployable,
  environment,
  version,
  branch,
  refType: process.env.GITHUB_REF_TYPE,
  tagExists: known && tagExists(tagFor(component, environment, version), cwd),
  peerExists,
  sameContent,
  previousVersion: known ? latestVersion(listTags(cwd), component, environment) : null,
});
if (checksFile) {
  errors.push(...evaluateChecks(JSON.parse(readFileSync(checksFile, 'utf8'))));
}

for (const error of errors) console.error(error);
if (errors.length > 0) {
  process.exitCode = 1;
} else {
  const tag = tagFor(component, environment, version);
  console.log(`Ready to release ${tag}.`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
}
