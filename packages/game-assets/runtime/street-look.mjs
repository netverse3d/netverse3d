import { YAW, snap } from './shop-look.mjs';

export const STREET_CELL = 4;
export const STOREY_HEIGHT = 3.4;
export const LOT_CELLS = 2;
export const SIDEWALK_TOP = 0.15;
const SIDEWALK_DEPTH = 1;
const ROAD_VARIANT = { straight: 'a', corner: 'b', tee: 'c' };
const OUTWARD = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
const ALONG = { south: [1, 0], north: [-1, 0], east: [0, -1], west: [0, 1] };
const OPPOSITE = { south: 'north', north: 'south', east: 'west', west: 'east' };
const DEFAULT_VARIANTS = {
  sidewalk: 'a',
  pole: 'a',
  wires: 'a',
  lamp: 'a',
  bin: 'a',
  planter: 'a',
  board: 'a',
  shopfront: 'a',
  storey: 'a',
  roof: 'a',
};

function cellCentre([x, z], [width, depth]) {
  return [(x - (width - 1) / 2) * STREET_CELL, (z - (depth - 1) / 2) * STREET_CELL];
}

function variantOf(block, slot, override) {
  return override ?? block.variants?.[slot] ?? DEFAULT_VARIANTS[slot] ?? 'a';
}

function placement(slot, variant, [x, z], yaw, y = 0, extra = {}) {
  return { slot, part: `${slot}_${variant}`, position: [snap(x), snap(y), snap(z)], yaw, ...extra };
}

export function roadPlacements(block) {
  return (block.roads ?? []).map((road) =>
    placement(
      'road',
      ROAD_VARIANT[road.kind],
      cellCentre(road.cell, block.cells),
      YAW[road.facing ?? 'south'],
    ),
  );
}

export function sidewalkPlacements(block) {
  return (block.sidewalks ?? []).map((walk) => {
    const [cx, cz] = cellCentre(walk.cell, block.cells);
    const [ox, oz] = OUTWARD[walk.side];
    const inset = STREET_CELL / 2 - SIDEWALK_DEPTH / 2;
    return placement(
      'sidewalk',
      variantOf(block, 'sidewalk'),
      [cx + ox * inset, cz + oz * inset],
      YAW[OPPOSITE[walk.side]],
    );
  });
}

export function lotFrontage(lot, block) {
  const [x, z] = lot.cell;
  const corner = cellCentre([x, z], block.cells);
  const far = cellCentre([x + LOT_CELLS - 1, z + LOT_CELLS - 1], block.cells);
  const centre = [(corner[0] + far[0]) / 2, (corner[1] + far[1]) / 2];
  const [ox, oz] = OUTWARD[lot.facing];
  const half = (LOT_CELLS * STREET_CELL) / 2;
  return {
    centre: [centre[0] + ox * half, centre[1] + oz * half],
    outward: [ox, oz],
    along: ALONG[lot.facing],
    yaw: YAW[lot.facing],
  };
}

export function facadePlacements(block) {
  return (block.lots ?? []).flatMap((lot) => {
    const { centre, along, yaw } = lotFrontage(lot, block);
    const storeys = lot.storeys ?? [variantOf(block, 'storey')];
    const columns = [-STREET_CELL / 2, STREET_CELL / 2];
    return columns.flatMap((offset) => {
      const at = [centre[0] + along[0] * offset, centre[1] + along[1] * offset];
      return [
        placement('shopfront', variantOf(block, 'shopfront'), at, yaw, 0, { lot: lot.id }),
        ...storeys.map((variant, index) =>
          placement('storey', variant, at, yaw, STOREY_HEIGHT * (index + 1), { lot: lot.id }),
        ),
        placement(
          'roof',
          variantOf(block, 'roof', lot.roof),
          at,
          yaw,
          STOREY_HEIGHT * (storeys.length + 1),
          {
            lot: lot.id,
          },
        ),
      ];
    });
  });
}

function propPlacement(block, prop, origin, yawBase) {
  const yaw = prop.facing ? YAW[prop.facing] : yawBase;
  return placement(
    prop.slot,
    variantOf(block, prop.slot, prop.variant),
    [origin[0] + prop.at[0], origin[1] + prop.at[1]],
    yaw,
    SIDEWALK_TOP,
  );
}

export function propPlacements(block) {
  const [width, depth] = block.cells;
  const originBlock = [
    (-(width - 1) / 2) * STREET_CELL - STREET_CELL / 2,
    (-(depth - 1) / 2) * STREET_CELL - STREET_CELL / 2,
  ];
  const own = (block.props ?? []).map((prop) => propPlacement(block, prop, originBlock, 0));
  const lotProps = (block.lots ?? []).flatMap((lot) => {
    const { centre, along, outward, yaw } = lotFrontage(lot, block);
    return (lot.props ?? []).map((prop) =>
      propPlacement(
        block,
        {
          ...prop,
          at: [
            along[0] * prop.at[0] + outward[0] * prop.at[1],
            along[1] * prop.at[0] + outward[1] * prop.at[1],
          ],
        },
        centre,
        yaw,
      ),
    );
  });
  return [...own, ...lotProps];
}

export function wirePlacements(poles, block) {
  const sorted = [...poles].sort(
    (a, b) => a.position[2] - b.position[2] || a.position[0] - b.position[0],
  );
  const wires = [];
  const near = (a, b) => Math.abs(a - b) < 0.001;
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i].position;
      const b = sorted[j].position;
      const middle = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
      if (near(a[2], b[2]) && near(Math.abs(a[0] - b[0]), STREET_CELL)) {
        wires.push(placement('wires', variantOf(block, 'wires'), middle, 0, a[1]));
      } else if (near(a[0], b[0]) && near(Math.abs(a[2] - b[2]), STREET_CELL)) {
        wires.push(placement('wires', variantOf(block, 'wires'), middle, Math.PI / 2, a[1]));
      }
    }
  }
  return wires;
}

export function streetPlan(block) {
  const props = propPlacements(block);
  const poles = props.filter((item) => item.slot === 'pole');
  return [
    ...roadPlacements(block),
    ...sidewalkPlacements(block),
    ...facadePlacements(block),
    ...props,
    ...wirePlacements(poles, block),
  ];
}

export function sidewalkWaypoints(block) {
  return sidewalkPlacements(block).map((walk) => [walk.position[0], walk.position[2]]);
}

export function roadLane(block) {
  return roadPlacements(block)
    .map((road) => [road.position[0], road.position[2]])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function lotCells(lot) {
  const cells = [];
  for (let dx = 0; dx < LOT_CELLS; dx += 1) {
    for (let dz = 0; dz < LOT_CELLS; dz += 1) cells.push(`${lot.cell[0] + dx},${lot.cell[1] + dz}`);
  }
  return cells;
}

export function blockIssues(block, kit) {
  const issues = [];
  const [width, depth] = block.cells;
  const roads = new Set((block.roads ?? []).map((road) => road.cell.join(',')));
  const taken = new Map();
  for (const lot of block.lots ?? []) {
    const [x, z] = lot.cell;
    if (x + LOT_CELLS > width || z + LOT_CELLS > depth)
      issues.push(`lot ${lot.id} leaves the block`);
    for (const cell of lotCells(lot)) {
      if (roads.has(cell)) issues.push(`lot ${lot.id} covers road cell ${cell}`);
      if (taken.has(cell)) issues.push(`lot ${lot.id} overlaps lot ${taken.get(cell)} at ${cell}`);
      taken.set(cell, lot.id);
    }
  }
  return [
    ...issues,
    ...missingParts(streetPlan(block), kit).map((part) => `${part} is not in the street kit`),
  ];
}

export function missingParts(plan, kit) {
  const known = new Set(
    Object.entries(kit.slots ?? {}).flatMap(([slot, spec]) =>
      spec.variants.map((variant) => `${slot}_${variant}`),
    ),
  );
  return [...new Set(plan.map((item) => item.part))].filter((part) => !known.has(part));
}
