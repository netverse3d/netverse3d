import { streetPlan } from './street-look.mjs';
import { YAW } from './shop-look.mjs';

const opposite = { north: 'south', south: 'north', east: 'west', west: 'east' };
const vectors = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const key = ([x, z]) => `${x},${z}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (p, factor) => [p[0] * factor, p[1] * factor];
const blockFor = (blocks, ref) =>
  Array.isArray(blocks) ? blocks.find((block) => block.id === ref) : blocks[ref];
const registered = (config, item) => {
  const kit = config.kits.find((entry) => entry.file === `${item.kit}.glb`);
  const slot = kit?.slots?.[item.slot];
  return Boolean(slot && (!item.variant || slot.variants.includes(item.variant)));
};
const pendingFor = (map, item) =>
  (map.pending ?? []).find(
    (entry) =>
      entry.kit === item.kit &&
      entry.slot === item.slot &&
      (!entry.variant || entry.variant === item.variant),
  );
const onRoad = (point, road) =>
  (road.from[0] === road.to[0] &&
    point[0] === road.from[0] &&
    point[1] >= Math.min(road.from[1], road.to[1]) &&
    point[1] <= Math.max(road.from[1], road.to[1])) ||
  (road.from[1] === road.to[1] &&
    point[1] === road.from[1] &&
    point[0] >= Math.min(road.from[0], road.to[0]) &&
    point[0] <= Math.max(road.from[0], road.to[0]));
const lotCells = (lot) =>
  Array.from({ length: lot.size[0] }, (_, x) =>
    Array.from({ length: lot.size[1] }, (_, z) => [lot.at[0] + x, lot.at[1] + z]),
  ).flat();
const blockCell = (block, placement, cell) => {
  const angle = (placement.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(angle));
  const sin = Math.round(Math.sin(angle));
  const x = cell[0] + 0.5 - block.cells[0] / 2;
  const z = cell[1] + 0.5 - block.cells[1] / 2;
  return [
    placement.at[0] + block.cells[0] / 2 + x * cos + z * sin - 0.5,
    placement.at[1] + block.cells[1] / 2 - x * sin + z * cos - 0.5,
  ];
};

export function cityMapIssues(map, { blocks, config }) {
  const issues = [];
  const report = (code, path) => issues.push({ code, path, message: code });
  for (const [di, district] of map.districts.entries()) {
    const base = `districts[${di}]`;
    const occupied = new Set();
    for (const [bi, placement] of district.blocks.entries()) {
      const block = blockFor(blocks, placement.ref);
      if (!block) report('block-missing', `${base}.blocks[${bi}].ref`);
      else
        for (const lot of block.lots ?? []) {
          for (let x = 0; x < 2; x += 1)
            for (let z = 0; z < 2; z += 1)
              occupied.add(key(blockCell(block, placement, add(lot.cell, [x, z]))));
        }
    }
    for (const [ri, road] of district.roads.entries()) {
      const path = `${base}.roads[${ri}]`;
      if (road.from[0] !== road.to[0] && road.from[1] !== road.to[1]) {
        report('road-not-axis', path);
        continue;
      }
      for (const end of [road.from, road.to]) {
        const connected =
          district.junctions.some((j) => key(j.at) === key(end)) ||
          district.roads.some((other) => other !== road && onRoad(end, other)) ||
          district.blocks.some((placement) => {
            const block = blockFor(blocks, placement.ref);
            return block?.roads.some((road) => {
              const [x, z] = road.cell;
              if (x !== 0 && z !== 0 && x !== block.cells[0] - 1 && z !== block.cells[1] - 1)
                return false;
              const point = blockCell(block, placement, road.cell);
              return Math.abs(point[0] - end[0]) + Math.abs(point[1] - end[1]) <= 1;
            });
          });
        if (!connected) report('road-gap', path);
      }
    }
    for (const [ji, junction] of district.junctions.entries()) {
      const path = `${base}.junctions[${ji}]`;
      for (const [ai, arm] of junction.arms.entries()) {
        const road = district.roads.find((entry) => entry.id === arm.road);
        const direction = vectors[arm.id];
        if (!road || !onRoad(junction.at, road) || !onRoad(add(junction.at, direction), road))
          report('junction-arm-road', `${path}.arms[${ai}].road`);
      }
      if (junction.signal?.order.some((arm) => !junction.arms.some((entry) => entry.id === arm)))
        report('signal-order-arm', `${path}.signal.order`);
    }
    for (const [li, lot] of district.lots.entries()) {
      const path = `${base}.lots[${li}]`;
      const cells = lotCells(lot);
      if (
        cells.some(
          (cell) =>
            district.roads.some((road) => onRoad(cell, road)) ||
            district.blocks.some((placement) => {
              const block = blockFor(blocks, placement.ref);
              return block?.roads.some(
                (road) => key(blockCell(block, placement, road.cell)) === key(cell),
              );
            }),
        )
      )
        report('lot-on-road', path);
      if (cells.some((cell) => occupied.has(key(cell)))) report('lot-overlap', path);
      cells.forEach((cell) => occupied.add(key(cell)));
      if (lot.kind === 'shop') {
        const direction = vectors[lot.facing];
        const sidewalkCells = district.blocks.flatMap((placement) => {
          const block = blockFor(blocks, placement.ref);
          if (!block) return [];
          return block.sidewalks.map((walk) => {
            const sides = ['north', 'west', 'south', 'east'];
            return {
              cell: blockCell(block, placement, walk.cell),
              side: sides[(sides.indexOf(walk.side) + placement.rotation / 90) % 4],
            };
          });
        });
        if (
          !cells.some(
            (cell) =>
              !cells.some((other) => key(other) === key(add(cell, direction))) &&
              sidewalkCells.some(
                (walk) =>
                  key(walk.cell) === key(add(cell, direction)) &&
                  walk.side === opposite[lot.facing],
              ),
          )
        )
          report('shop-lot-no-sidewalk', path);
      }
      for (const [ci, component] of lot.components.entries())
        if (!registered(config, component) && !pendingFor(map, component))
          report('unregistered', `${path}.components[${ci}]`);
    }
  }
  for (const [pi, pending] of (map.pending ?? []).entries())
    if (registered(config, pending)) report('pending-resolved', `pending[${pi}]`);
  return issues;
}

export function junctionPlanFor(junction) {
  const arms = junction.arms.map((arm) => arm.id);
  return {
    ...junction.signal,
    arms,
    crossings: junction.arms
      .filter((arm) => arm.crossing)
      .map((arm) => ({
        id: arm.id,
        conflictingArms: [arm.id, opposite[arm.id]].filter((id) => arms.includes(id)),
      })),
  };
}

export function cityPlan(map, { blocks }) {
  const placements = [],
    pendingPlacements = [];
  for (const district of map.districts) {
    for (const entry of district.blocks) {
      const block = blockFor(blocks, entry.ref);
      if (!block) continue;
      const angle = (entry.rotation * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const centre = scale(
        add(add(district.origin, entry.at), [(block.cells[0] - 1) / 2, (block.cells[1] - 1) / 2]),
        map.grid,
      );
      for (const item of streetPlan(block)) {
        const [x, y, z] = item.position;
        placements.push({
          ...item,
          position: [centre[0] + x * cos + z * sin, y, centre[1] - x * sin + z * cos],
          yaw: item.yaw + angle,
          block: entry.ref,
        });
      }
    }
    for (const lot of district.lots)
      for (const item of lot.components) {
        const origin = scale(add(district.origin, lot.at), map.grid),
          at = item.at ?? [0, 0];
        const placement = {
          slot: item.slot,
          part: `${item.slot}_${item.variant}`,
          kit: item.kit,
          position: [origin[0] + at[0], 0, origin[1] + at[1]],
          yaw: YAW[item.facing ?? lot.facing],
          lot: lot.id,
        };
        const pending = pendingFor(map, item);
        if (pending) pendingPlacements.push({ ...placement, issue: pending.issue });
        else placements.push(placement);
      }
  }
  return { placements, pendingPlacements };
}

export function mapBounds(map, { blocks }) {
  const points = [];
  for (const district of map.districts) {
    const addPoint = (point) => points.push(scale(add(district.origin, point), map.grid));
    for (const road of district.roads) {
      addPoint(road.from);
      addPoint(road.to);
    }
    for (const lot of district.lots) {
      addPoint(lot.at);
      addPoint(add(lot.at, lot.size));
    }
    for (const entry of district.blocks) {
      const block = blockFor(blocks, entry.ref);
      if (block) {
        const center = add(entry.at, [(block.cells[0] - 1) / 2, (block.cells[1] - 1) / 2]);
        const quarter = entry.rotation % 180 !== 0;
        const width = (quarter ? block.cells[1] : block.cells[0]) / 2;
        const depth = (quarter ? block.cells[0] : block.cells[1]) / 2;
        addPoint([center[0] - width, center[1] - depth]);
        addPoint([center[0] + width, center[1] + depth]);
      }
    }
  }
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minZ: Math.min(...points.map((p) => p[1])),
    maxZ: Math.max(...points.map((p) => p[1])),
  };
}

export function stopLinesFor(map, route, plan) {
  const points = route.points;
  let distance = 0;
  const lines = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1],
      to = points[i],
      length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (const district of map.districts)
      for (const junction of district.junctions)
        for (const arm of junction.arms) {
          const direction =
            to[0] > from[0]
              ? 'west'
              : to[0] < from[0]
                ? 'east'
                : to[1] > from[1]
                  ? 'north'
                  : 'south';
          if (arm.id !== direction || !plan.arms.includes(arm.id)) continue;
          const at = scale(add(district.origin, junction.at), map.grid);
          const along =
            ((at[0] - from[0]) * (to[0] - from[0]) + (at[1] - from[1]) * (to[1] - from[1])) /
            length;
          const perpendicular =
            Math.abs(
              (at[0] - from[0]) * (to[1] - from[1]) - (at[1] - from[1]) * (to[0] - from[0]),
            ) / length;
          if (
            perpendicular < 0.001 &&
            along >= 0 &&
            along <= length &&
            distance + along >= arm.stopLine
          )
            lines.push({ distance: distance + along - arm.stopLine, arm: arm.id, plan });
        }
    distance += length;
  }
  return lines;
}
