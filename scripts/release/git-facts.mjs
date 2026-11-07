import { execFileSync } from 'node:child_process';

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function gitOutputOrNull(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

export function tagExists(tag, cwd) {
  return gitOutputOrNull(['rev-parse', '-q', '--verify', `refs/tags/${tag}`], cwd) !== null;
}

export function treeOf(ref, cwd) {
  return gitOutputOrNull(['rev-parse', `${ref}^{tree}`], cwd);
}

export function listTags(cwd) {
  return (gitOutputOrNull(['tag', '--list'], cwd) ?? '').split('\n').filter(Boolean);
}

export function remoteBranchesContaining(ref, cwd) {
  return (
    gitOutputOrNull(['branch', '-r', '--contains', ref, '--format=%(refname:short)'], cwd) ?? ''
  )
    .split('\n')
    .filter(Boolean)
    .map((name) => name.replace(/^origin\//, ''));
}

export function changedFiles(from, to, cwd) {
  if (!from) return null;
  return (gitOutputOrNull(['diff', '--name-only', from, to], cwd) ?? '')
    .split('\n')
    .filter(Boolean);
}
