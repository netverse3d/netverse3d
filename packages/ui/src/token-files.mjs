import { readFileSync } from 'node:fs';
import { parseTokenRules } from './tokens.mjs';

export const TOKEN_FILES = ['primitive', 'semantic', 'motion'];

export function readTokenRules() {
  return TOKEN_FILES.flatMap((name) =>
    parseTokenRules(readFileSync(new URL(`../tokens/${name}.css`, import.meta.url), 'utf8')),
  );
}
