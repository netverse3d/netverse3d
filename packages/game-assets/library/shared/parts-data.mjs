import { ROOM_KIT } from './catalog.mjs';

export { ROOM_KIT };

const NEAR_BUDGET = 0.85;

function normalised(text) {
  return text.trim().toLocaleLowerCase('vi');
}

export function partGroups(config, kitFiles) {
  return kitFiles
    .map((file) => (config.kits ?? []).find((kit) => kit.file === file))
    .filter(Boolean)
    .map((kit) => ({
      kit: kit.file,
      slots: Object.entries(kit.slots ?? {}).map(([slot, spec]) => ({
        slot,
        maxTriangles: spec.maxTriangles,
        size: spec.size,
        parts: spec.variants.map((variant) => ({
          name: `${slot}_${variant}`,
          slot,
          variant,
          kit: kit.file,
        })),
      })),
    }));
}

export function partCount(groups) {
  return groups.reduce(
    (total, group) => total + group.slots.reduce((sum, slot) => sum + slot.parts.length, 0),
    0,
  );
}

export function filterParts(groups, { kit, query }, slotLabels = {}) {
  const wanted = normalised(query ?? '');
  const matches = (slot, part) =>
    wanted === '' ||
    normalised(part.name).includes(wanted) ||
    normalised(slotLabels[slot.slot] ?? '').includes(wanted);
  return groups
    .filter((group) => !kit || group.kit === kit)
    .map((group) => ({
      ...group,
      slots: group.slots
        .map((slot) => ({ ...slot, parts: slot.parts.filter((part) => matches(slot, part)) }))
        .filter((slot) => slot.parts.length > 0),
    }))
    .filter((group) => group.slots.length > 0);
}

export function budgetUse(triangles, maxTriangles) {
  if (!(maxTriangles > 0)) {
    return triangles > 0 ? { ratio: 1, level: 'over' } : { ratio: 0, level: 'ok' };
  }
  const ratio = triangles / maxTriangles;
  if (ratio > 1) return { ratio: 1, level: 'over' };
  return { ratio, level: ratio >= NEAR_BUDGET ? 'near' : 'ok' };
}

export function shopsUsing(recipes, recipeIds, slot, variant) {
  return recipeIds
    .filter((id) => recipes[id]?.variants?.[slot] === variant)
    .map((id) => recipes[id].name);
}

export function withKeyboard(recipe, change) {
  if (Object.keys(change).length === 0) return recipe;
  return { ...recipe, keyboard: { ...recipe.keyboard, ...change } };
}
