import { gitLines, gitOutputOrNull } from '../lib/git.mjs';

export function tagExists(tag, cwd) {
  return gitOutputOrNull(['rev-parse', '-q', '--verify', `refs/tags/${tag}`], cwd) !== null;
}

export function treeOf(ref, cwd) {
  return gitOutputOrNull(['rev-parse', `${ref}^{tree}`], cwd);
}

export function listTags(cwd) {
  return gitLines(['tag', '--list'], cwd);
}

export function remoteBranchesContaining(ref, cwd) {
  return gitLines(['branch', '-r', '--contains', ref, '--format=%(refname:short)'], cwd).map(
    (name) => name.replace(/^origin\//, ''),
  );
}

export function changedFiles(from, to, cwd, paths = []) {
  if (!from) return null;
  const pathArguments = paths.length > 0 ? ['--', ...paths] : [];
  return gitLines(['diff', '--name-only', from, to, ...pathArguments], cwd);
}
