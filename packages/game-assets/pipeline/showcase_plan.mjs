import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitAnchors, roomPlan, shopPlan } from '../runtime/shop-look.mjs';
import { streetPlan } from '../runtime/street-look.mjs';
import { readGlb } from '../tools/lib.mjs';

const SHOWCASE_LAYOUT = {
  cells: [3, 2],
  stations: [
    { cell: [0, 0], facing: 'north' },
    { cell: [1, 0], facing: 'north' },
    { cell: [2, 0], facing: 'north' },
  ],
  door: { wall: 'east', at: 1 },
  windows: [{ wall: 'north', at: 1 }],
};
const OPEN_YAWS = [Math.PI, -Math.PI / 2];
const CORNER_TO_WALL = { [Math.PI]: Math.PI, 0: -Math.PI / 2 };
const near = (a, b) => Math.abs(a - b) < 1e-6;

export function buildShowcasePlan(root, recipeId = 'tim-neon') {
  const recipe = JSON.parse(readFileSync(join(root, 'recipes', `${recipeId}.json`), 'utf8'));
  recipe.layout = SHOWCASE_LAYOUT;
  const anchors = {
    ...kitAnchors(readGlb(readFileSync(join(root, 'exported', 'station-parts.glb')))),
    ...kitAnchors(readGlb(readFileSync(join(root, 'exported', 'room-kit.glb')))),
  };
  const room = roomPlan(recipe).flatMap((placement) => {
    if (placement.slot === 'floor') return [placement];
    if (['ceiling', 'light', 'door'].includes(placement.slot)) return [];
    if (placement.slot === 'corner') {
      if (near(placement.yaw, -Math.PI / 2)) return [placement];
      const wallYaw = Object.entries(CORNER_TO_WALL).find(([yaw]) =>
        near(placement.yaw, Number(yaw)),
      );
      return wallYaw ? [{ ...placement, slot: 'wall', part: 'wall_a', yaw: wallYaw[1] }] : [];
    }
    return OPEN_YAWS.some((yaw) => near(placement.yaw, yaw)) ? [placement] : [];
  });
  const stations = shopPlan(recipe, anchors);
  return { recipe: recipe.id, cells: recipe.layout.cells, room, stations };
}

export function buildStreetShowcasePlan(root, blockId = 'hem-mau', recipeId = 'tim-neon') {
  const block = JSON.parse(readFileSync(join(root, 'blocks', `${blockId}.json`), 'utf8'));
  const basePlacements = streetPlan(block);
  const signs = [
    { slot: 'sign', part: 'sign_a', position: [-4, 3.8, 2.05], yaw: 0 },
    { slot: 'blade', part: 'blade_a', position: [-6.1, 3.2, 2.3], yaw: Math.PI / 2 },
    { slot: 'festoon', part: 'festoon_a', position: [0, 4.2, 3.2], yaw: 0 },
    { slot: 'sign', part: 'sign_b', position: [4, 3.8, 2.05], yaw: 0 },
    { slot: 'blade', part: 'blade_a', position: [2.1, 3.2, 2.3], yaw: -Math.PI / 2 },
  ];
  const placements = [...basePlacements, ...signs];
  const lamps = placements
    .filter((p) => p.part.startsWith('lamp_'))
    .map((p, i) => ({
      name: `lamp_light_${i}`,
      type: 'POINT',
      position: [p.position[0], p.position[1] + 3.8, p.position[2]],
      color: [1.0, 0.78, 0.45],
      energy: 400.0,
      radius: 0.3,
    }));
  lamps.push({
    name: 'street_fill',
    type: 'AREA',
    position: [0, 8.0, 3.5],
    color: [0.4, 0.35, 0.6],
    energy: 160.0,
    size: 14.0,
  });
  return {
    kind: 'street',
    id: `showcase-${blockId}`,
    recipe: recipeId,
    block: blockId,
    cells: block.cells,
    placements,
    lamps,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const target = process.argv[2] ?? 'tim-neon';
  const isStreet = target.startsWith('hem') || target.startsWith('street');
  const plan = isStreet
    ? buildStreetShowcasePlan(resolve(here, '..'), target, 'tim-neon')
    : buildShowcasePlan(resolve(here, '..'), target);
  const out = join(here, 'showcase-plan.json');
  writeFileSync(out, JSON.stringify(plan, null, 2));
  console.log(
    `wrote ${out}: ${plan.placements ? plan.placements.length : plan.room.length + plan.stations.length} parts`,
  );
}
