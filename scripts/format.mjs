import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PRETTIER_CLI = 'node_modules/prettier/bin/prettier.cjs';
const CHUNK_SIZE = 100;

export function listRepositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return output.split('\0').filter((file) => file && existsSync(file));
}

function run(mode) {
  const files = listRepositoryFiles();
  let exitCode = 0;
  for (let start = 0; start < files.length; start += CHUNK_SIZE) {
    const chunk = files.slice(start, start + CHUNK_SIZE);
    const result = spawnSync(
      process.execPath,
      [PRETTIER_CLI, mode, '--ignore-unknown', '--log-level=warn', ...chunk],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) exitCode = result.status ?? 1;
  }
  return exitCode;
}

const mode = process.argv[2] === '--write' ? '--write' : '--check';
process.exitCode = run(mode);
