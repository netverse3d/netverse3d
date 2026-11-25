import { readFileSync } from 'node:fs';

export function loadRegistry() {
  return JSON.parse(readFileSync(new URL('../components/registry.json', import.meta.url), 'utf8'));
}
