import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import {
  assessDrift,
  collectChanges,
  currentBranch,
  GUIDANCE,
  linkedReferences,
  loadTraceData,
  resolveBase,
} from './lib.mjs';

function repositoryRoot(cwd) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function assess(input) {
  const cwd = input.cwd ?? process.cwd();
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!target) return null;
  const root = repositoryRoot(cwd);
  const file = relative(root, resolve(cwd, target)).replaceAll('\\', '/');
  if (file.startsWith('../')) return null;
  const branch = currentBranch(root);
  const base = resolveBase('HEAD', '', root);
  const { references } = base ? collectChanges(base, 'HEAD', root) : { references: [] };
  const { requirements, decisions } = loadTraceData(root);
  const allReferences = [...new Set([...references, ...linkedReferences(branch, root)])];
  const result = assessDrift({
    files: [file],
    references: allReferences,
    requirements,
    decisions,
  });
  return result.status === 'ask' ? result.reasons : null;
}

function respond(reasons) {
  const reason = [
    'This edit may drift from the agreed requirements.',
    ...reasons,
    ...GUIDANCE,
    'Ask the person working here which requirement applies before continuing.',
  ].join(' ');
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
}

try {
  const reasons = assess(JSON.parse(readFileSync(0, 'utf8')));
  if (reasons) respond(reasons);
} catch (error) {
  console.error(`Drift check skipped: ${error.message}`);
}
