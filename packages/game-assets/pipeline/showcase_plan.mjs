import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitAnchors, roomPlan, shopPlan } from '../runtime/shop-look.mjs';
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const plan = buildShowcasePlan(resolve(here, '..'), process.argv[2] ?? 'tim-neon');
  const out = join(here, 'showcase-plan.json');
  writeFileSync(out, JSON.stringify(plan, null, 2));
  console.log(
    `wrote ${out}: ${plan.room.length} room modules, ${plan.stations.length} station parts`,
  );
}
