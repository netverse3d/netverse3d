import { evaluateReferences, extractReferences } from '../trace/lib.mjs';
import { currentBranch, linkReference, loadTraceData } from './lib.mjs';

const root = process.cwd();
const reference = process.argv[2] ?? '';
const branch = currentBranch(root);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (extractReferences(reference)[0] !== reference) {
  fail('Usage: pnpm trace:link REQ-001 or pnpm trace:link ADR-0001');
} else if (!branch) {
  fail('Check out a branch before linking a requirement.');
} else {
  const { requirements, decisions } = loadTraceData(root);
  const { errors, warnings } = evaluateReferences([reference], requirements, decisions);
  if (errors.length > 0) {
    fail(errors.join('\n'));
  } else {
    linkReference(branch, reference, root);
    for (const warning of warnings) console.warn(warning);
    console.log(`Linked ${reference} to ${branch}.`);
  }
}
