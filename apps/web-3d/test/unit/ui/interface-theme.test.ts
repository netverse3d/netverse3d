import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contrastRatio } from '@netverse/ui/contrast';
import { readTokenRules } from '@netverse/ui/token-files';
import { resolveToken, tokenDefaults } from '@netverse/ui/tokens';
import { applyInterfaceTheme, type ThemeRoot } from '../../../src/ui/interface-theme.ts';

const tokens = tokenDefaults(readTokenRules());
const onAccent = resolveToken('--ui-on-action', tokens) as string;
const surfaces = ['--ui-surface', '--ui-surface-raised', '--ui-surface-glass'].map(
  (name) => resolveToken(name, tokens) as string,
);

function fakeRoot(): ThemeRoot & { properties: Map<string, string> } {
  const properties = new Map<string, string>();
  return {
    dataset: {},
    properties,
    style: {
      setProperty: (name: string, value: string) => void properties.set(name, value),
      removeProperty: (name: string) => {
        properties.delete(name);
        return '';
      },
    },
  };
}

function recipeAccents(): string[] {
  const recipes = new URL('../../../../../packages/game-assets/recipes/', import.meta.url);
  const ids = JSON.parse(readFileSync(new URL('index.json', recipes), 'utf8')) as string[];
  return ids.flatMap(
    (id) =>
      (
        JSON.parse(readFileSync(new URL(`${id}.json`, recipes), 'utf8')) as {
          palette: { accent?: string[] };
        }
      ).palette.accent ?? [],
  );
}

test('gắn mức chất lượng lên gốc trang và gỡ khi rời', () => {
  const root = fakeRoot();
  const cleanup = applyInterfaceTheme(
    root,
    { quality: 'low', accent: null },
    { surfaces, onAccent },
  );
  assert.equal(root.dataset.uiQuality, 'low');
  assert.equal(root.properties.has('--ui-accent'), false);
  cleanup();
  assert.equal(root.dataset.uiQuality, undefined);
});

test('accent tiệm đạt 3:1 trên mọi mặt nền và chữ trên accent đạt 4.5:1 sau khi gắn', () => {
  const accents = recipeAccents();
  assert.ok(accents.length > 0);
  for (const accent of accents) {
    const root = fakeRoot();
    const cleanup = applyInterfaceTheme(
      root,
      { quality: 'medium', accent },
      { surfaces, onAccent },
    );
    const applied = root.properties.get('--ui-accent');
    assert.ok(applied, accent);
    for (const surface of surfaces)
      assert.ok(contrastRatio(applied, surface) >= 3, `${accent} → ${applied} / ${surface}`);
    assert.ok(contrastRatio(onAccent, applied) >= 4.5, `${onAccent} / ${applied}`);
    cleanup();
    assert.equal(root.properties.has('--ui-accent'), false);
  }
});
