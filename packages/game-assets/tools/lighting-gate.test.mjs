import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listSourceFiles, scanSources } from './source-scan.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const RUNTIME_ROOT = join(REPOSITORY_ROOT, 'packages/game-assets/runtime').replaceAll('\\', '/');
const LIGHTING_RULE = 'lighting';
const SOURCE_ROOTS = [
  join(REPOSITORY_ROOT, 'apps/web-3d/src'),
  join(REPOSITORY_ROOT, 'packages/game-assets/library'),
  { path: RUNTIME_ROOT, recursive: false },
];
const SOURCE_FILES = listSourceFiles(SOURCE_ROOTS, {
  extensions: ['.ts', '.tsx', '.html', '.mjs'],
  skip: (file) =>
    file === `${RUNTIME_ROOT}/lighting.mjs` ||
    (file.startsWith(`${RUNTIME_ROOT}/`) && file.endsWith('.test.mjs')),
});
const LIGHTING_RULES = [
  {
    rule: LIGHTING_RULE,
    pattern: /\bnew\s+(?:THREE\.)?(?:Ambient|Hemisphere|Directional|Point|Spot|RectArea)Light\s*\(/,
  },
  {
    rule: LIGHTING_RULE,
    pattern: /\b(?:toneMapping|toneMappingExposure|outputColorSpace)\s*=/,
  },
  {
    rule: LIGHTING_RULE,
    pattern: /\bscene\.(?:fog|environment|background)\s*=/,
  },
  { rule: LIGHTING_RULE, pattern: /\bnew\s+RoomEnvironment\s*\(/ },
  {
    rule: LIGHTING_RULE,
    pattern: /\bnew\s+UnrealBloomPass\s*\((?:(?:[^()]|\([^()]*\)))*?\b\d+(?:\.\d+)?/,
  },
];
const LIGHTING_ALLOWLIST = [
  {
    file: join(REPOSITORY_ROOT, 'packages/game-assets/library/studio.html'),
    rule: LIGHTING_RULE,
    reason: 'legacy multi-scene page listed as Trang cũ nhiều cảnh',
  },
];

function describe(matches) {
  return matches
    .map(({ file, line, rule, match }) => `${file}:${line} [${rule}] ${match}`)
    .join('\n');
}

test('mọi thiết lập ánh sáng ngoài trang cũ dùng bộ ánh sáng chung', () => {
  const matches = scanSources(SOURCE_FILES, LIGHTING_RULES, LIGHTING_ALLOWLIST);
  assert.deepEqual(matches, [], describe(matches));
});
