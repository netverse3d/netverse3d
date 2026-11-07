import { execFileSync } from 'node:child_process';

export function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

export function gitOutputOrNull(args, cwd) {
  try {
    return git(args, cwd).trim();
  } catch {
    return null;
  }
}

export function gitLines(args, cwd) {
  return git(args, cwd).split('\n').filter(Boolean);
}
