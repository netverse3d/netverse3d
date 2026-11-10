import { findViolations } from './lib.mjs';
import { RULES } from './rules.mjs';

const violations = findViolations(process.cwd(), RULES);

for (const violation of violations) console.error(violation);
if (violations.length > 0) {
  console.error('See docs/wiki/engineering/web-client.md for the layer rules.');
  process.exitCode = 1;
} else {
  console.log(`Layer boundaries valid: ${RULES.length} layers checked.`);
}
