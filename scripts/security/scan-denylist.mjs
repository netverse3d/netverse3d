import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { buildPatterns, findMatches } from './denylist.mjs';

const ENV_NAME = 'DENYLIST_PATTERNS';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const extra = process.env[ENV_NAME] ?? '';
if (process.argv.includes('--require-env') && !extra.trim()) {
  console.error(`${ENV_NAME} is empty, so the scan would miss project-specific terms.`);
  process.exit(1);
}

const patterns = buildPatterns(extra);
const findings = [];

for (const file of git('ls-files', '-z').split('\0').filter(Boolean)) {
  if (!existsSync(file)) continue;
  findings.push(...findMatches(file, readFileSync(file).toString('utf8'), patterns));
}

const commitRange = argument('commit-range');
if (commitRange) {
  const log = git('log', '--format=%h%x00%B%x00', commitRange).split('\0');
  for (let index = 0; index + 1 < log.length; index += 2) {
    const sha = log[index].trim();
    findings.push(...findMatches(`commit ${sha}`, log[index + 1], patterns));
  }
}

for (const finding of findings) {
  const location = finding.line ? `${finding.file}:${finding.line}` : `${finding.file} (name)`;
  console.error(`Denied term at ${location}`);
}

if (findings.length > 0) {
  console.error('Remove this content: the repository is public.');
  process.exitCode = 1;
} else {
  console.log('Denylist scan passed.');
}
