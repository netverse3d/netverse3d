import { readFileSync } from 'node:fs';
import {
  assessDrift,
  collectChanges,
  GUIDANCE,
  linkedReferences,
  loadTraceData,
  NEEDS_CONFIRMATION,
  NO_COMMIT,
  resolveBase,
} from './lib.mjs';

const root = process.cwd();
const { requirements, decisions } = loadTraceData(root);
const reasons = [];

for (const line of readFileSync(0, 'utf8').split('\n').filter(Boolean)) {
  const [localRef, localSha, , remoteSha] = line.split(' ');
  if (!localRef?.startsWith('refs/heads/') || NO_COMMIT.test(localSha)) continue;
  const branch = localRef.slice('refs/heads/'.length);
  const base = resolveBase(localSha, remoteSha, root);
  const { files, references } = collectChanges(base, localSha, root);
  const allReferences = [...new Set([...references, ...linkedReferences(branch, root)])];
  const result = assessDrift({ files, references: allReferences, requirements, decisions });
  if (result.status === 'ask') reasons.push(...result.reasons.map((r) => `${branch}: ${r}`));
}

if (reasons.length > 0) {
  console.error('Possible drift from the agreed requirements:');
  for (const reason of reasons) console.error(`  - ${reason}`);
  for (const hint of GUIDANCE) console.error(`  > ${hint}`);
  process.exitCode = NEEDS_CONFIRMATION;
}
