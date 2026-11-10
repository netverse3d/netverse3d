import type { FloorBox } from '@netverse/game-shared/movement';

export const CELL_SIZE = 2;
export const WALL_THICKNESS = 0.2;
export const WALL_MODEL_DEPTH = 0.36;

const PERIMETER_DEPTH = 1;

function insetFloor([width, depth]: readonly [number, number], inset: number): FloorBox {
  const halfWidth = (width * CELL_SIZE) / 2 - inset;
  const halfDepth = (depth * CELL_SIZE) / 2 - inset;
  return { minX: -halfWidth, maxX: halfWidth, minZ: -halfDepth, maxZ: halfDepth };
}

export function shopInterior(cells: readonly [number, number]): FloorBox {
  return insetFloor(cells, WALL_THICKNESS);
}

export function shopOpenFloor(cells: readonly [number, number]): FloorBox {
  return insetFloor(cells, WALL_MODEL_DEPTH);
}

export function shopPerimeter([width, depth]: readonly [number, number]): FloorBox[] {
  const halfWidth = (width * CELL_SIZE) / 2;
  const halfDepth = (depth * CELL_SIZE) / 2;
  const outerWidth = halfWidth + PERIMETER_DEPTH;
  const outerDepth = halfDepth + PERIMETER_DEPTH;
  return [
    { minX: -outerWidth, maxX: outerWidth, minZ: -outerDepth, maxZ: -halfDepth },
    { minX: -outerWidth, maxX: outerWidth, minZ: halfDepth, maxZ: outerDepth },
    { minX: -outerWidth, maxX: -halfWidth, minZ: -outerDepth, maxZ: outerDepth },
    { minX: halfWidth, maxX: outerWidth, minZ: -outerDepth, maxZ: outerDepth },
  ];
}
