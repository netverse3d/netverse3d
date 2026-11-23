import assert from 'node:assert/strict';
import test from 'node:test';
import { MIDRISE_RECIPES, midrisePlan } from './midrise-look.mjs';

test('ba công thức dùng tầng đúng lưới bốn mét và phủ kín mái', () => {
  assert.equal(new Set(MIDRISE_RECIPES.map((recipe) => recipe.palette)).size, 3);
  for (const recipe of MIDRISE_RECIPES) {
    const { width, depth, floors, palette } = recipe;
    const parts = midrisePlan(recipe);
    const roofs = parts.filter(([name]) => name.startsWith('midrise_roof_'));
    assert.equal(roofs.length, width * depth);
    assert.equal(new Set(roofs.map(([, position]) => position.join(','))).size, roofs.length);
    assert.equal(parts.length - roofs.length, 2 * (width + depth) * floors);
    assert.ok(parts.every(([, [, y], , color]) => y % 4 === 0 && color === palette));
    assert.ok(roofs.every(([, [, y]]) => y === floors * 4));
    assert.equal(parts.filter(([name]) => name === 'midrise_ground_b').length, 1);
  }
});
