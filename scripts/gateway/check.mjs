import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  COMPOSE_FILE,
  findUntrustedBackends,
  loadRoutes,
  renderAll,
  validateRoutes,
} from './lib.mjs';

const doc = loadRoutes();
const errors = validateRoutes(doc);

if (errors.length === 0) {
  for (const [path, expected] of Object.entries(renderAll(doc))) {
    const actual = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (actual !== expected)
      errors.push(`gateway config is stale, run pnpm gateway:render: ${path}`);
  }
}

const compose = parse(readFileSync(COMPOSE_FILE, 'utf8'));
for (const service of findUntrustedBackends(doc, compose)) {
  console.warn(`${service} must set TRUST_PROXY_HOPS=1 behind the gateway`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log('Gateway config matches infra/gateway/routes.yaml.');
