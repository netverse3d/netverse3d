import { instanceGroups } from './shop-look.mjs';
import { buildShop } from './three-shop.mjs';

export const STREET_INDIVIDUAL_RULES = [
  { part: /^(car|motorbike)_/, primitive: /.*/ },
  { part: /^signal_/, primitive: /_bulb_/ },
  { part: /^walk_/, primitive: /_(stop|go)$/ },
];

export function streetPrimitiveMode(part, primitive, rules = STREET_INDIVIDUAL_RULES) {
  return rules.some((rule) => rule.part.test(part) && rule.primitive.test(primitive))
    ? 'individual'
    : 'instance';
}

export function streetAssemblyPlan(plan, primitivesByPart, rules = STREET_INDIVIDUAL_RULES) {
  return [...instanceGroups(plan)].flatMap(([part, placements]) => {
    const primitives = primitivesByPart[part];
    if (!primitives) throw new Error(`kit has no part ${part}`);
    return primitives.map((primitive) => ({
      part,
      primitive,
      mode: streetPrimitiveMode(part, primitive, rules),
      placements,
    }));
  });
}

export function streetDrawCounts(groups) {
  return groups.reduce(
    (counts, group) => ({
      before: counts.before + group.placements.length,
      after: counts.after + (group.mode === 'instance' ? 1 : group.placements.length),
    }),
    { before: 0, after: 0 },
  );
}

export function selectStreetLod(part, distance, lod) {
  return lod && distance >= lod.distance ? `${part}_${lod.suffix}` : part;
}

export function buildStreet(THREE, kitScene, plan, materials, { instance = true } = {}) {
  return buildShop(THREE, kitScene, plan, materials, {
    individualPrimitive: (part, primitive) => streetPrimitiveMode(part, primitive) === 'individual',
    instance,
  });
}
