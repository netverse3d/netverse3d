import { git, gitOutputOrNull } from '../lib/git.mjs';
import {
  evaluateReferences,
  extractReferences,
  isProductPath,
  loadDecisions,
  loadRegistry,
} from '../trace/lib.mjs';

export const NEEDS_CONFIRMATION = 3;
export const NO_COMMIT = /^0+$/;

function gitOutputOrEmpty(args, cwd) {
  return gitOutputOrNull(args, cwd) ?? '';
}

function lines(text) {
  return text.split('\n').filter(Boolean);
}

export function currentBranch(cwd) {
  return gitOutputOrEmpty(['branch', '--show-current'], cwd);
}

export function linkedReferences(branch, cwd) {
  if (!branch) return [];
  return lines(gitOutputOrEmpty(['config', '--get-all', `branch.${branch}.trace`], cwd));
}

export function linkReference(branch, reference, cwd) {
  if (linkedReferences(branch, cwd).includes(reference)) return;
  git(['config', '--add', `branch.${branch}.trace`, reference], cwd);
}

export function resolveBase(sha, remoteSha, cwd) {
  if (remoteSha && !NO_COMMIT.test(remoteSha)) return remoteSha;
  return gitOutputOrEmpty(['merge-base', sha, 'origin/staging'], cwd);
}

export function collectChanges(base, sha, cwd) {
  const range = base ? `${base}..${sha}` : sha;
  const files = lines(
    base
      ? gitOutputOrEmpty(['diff', '--name-only', `${base}...${sha}`], cwd)
      : gitOutputOrEmpty(['show', '--name-only', '--format=', sha], cwd),
  );
  const messages = gitOutputOrEmpty(['log', '--format=%B', range], cwd);
  return { files, references: extractReferences(messages) };
}

export function assessDrift({ files, references, requirements, decisions }) {
  const productFiles = files.filter(isProductPath);
  if (productFiles.length === 0) return { status: 'ok', reasons: [] };
  if (references.length === 0) {
    return {
      status: 'ask',
      reasons: [
        `No REQ or ADR is linked to these product changes: ${productFiles.slice(0, 5).join(', ')}`,
      ],
    };
  }
  const { errors, warnings } = evaluateReferences(references, requirements, decisions);
  if (errors.length > 0 || warnings.length > 0) {
    return { status: 'ask', reasons: [...errors, ...warnings] };
  }
  return { status: 'ok', reasons: [] };
}

export function loadTraceData(root) {
  return { requirements: loadRegistry(root), decisions: loadDecisions(root) };
}

export const GUIDANCE = [
  'Link the agreed requirement: pnpm trace:link REQ-001',
  'If the requirement changed, record it first in docs/requirements/registry.yaml or docs/decisions.',
];
