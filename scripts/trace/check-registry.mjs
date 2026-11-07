import { loadDecisions, loadRegistry, validateDecisions, validateRegistry } from './lib.mjs';

const root = process.cwd();
const requirements = loadRegistry(root);
const decisions = loadDecisions(root);
const errors = [...validateRegistry(requirements), ...validateDecisions(decisions)];

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log(`Registry valid: ${requirements.length} REQ, ${decisions.length} ADR.`);
