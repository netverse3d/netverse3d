import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findMatches } from './denylist.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const findings = [];

for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) {
  if (!existsSync(file)) continue;
  findings.push(...findMatches(file, readFileSync(file).toString('utf8')));
}

const commitRange = argument('commit-range');
if (commitRange) {
  const log = git('log', '--format=%h%x00%B%x00', commitRange).split('\0');
  for (let index = 0; index + 1 < log.length; index += 2) {
    const sha = log[index].trim();
    findings.push(...findMatches(`commit ${sha}`, log[index + 1]));
  }
}

for (const finding of findings) {
  const location = finding.line ? `${finding.file}:${finding.line}` : `${finding.file} (name)`;
  console.error(`Student ID found at ${location}`);
}

if (findings.length > 0) {
  console.error('Remove this content: the repository is public.');
  process.exitCode = 1;
} else {
  console.log('Student ID scan passed.');
}
