export const PALETTE_WIDTH = 128;
const CELL_SIZE = 2;
const STATION_SLOTS = ['monitor', 'keyboard', 'mouse', 'mat', 'headset', 'mic', 'chair', 'case'];
const SPEAKER_SOCKETS = ['socket_speaker_left', 'socket_speaker_right'];
const YAW = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
const ANCHOR_SEPARATOR = '__';
const PRECISION = 1e4;

export function paletteRows(palette) {
  return [...palette.surface, ...palette.glow];
}

function hexToBytes(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [16, 8, 0].map((shift) => (value >> shift) & 255);
}

function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

export function colorAt(stops, u) {
  if (stops.length === 1) return hexToBytes(stops[0]);
  const t = Math.min(Math.max(u, 0), 1) * (stops.length - 1);
  const index = Math.min(Math.floor(t), stops.length - 2);
  const fraction = t - index;
  const from = hexToBytes(stops[index]).map((byte) => srgbToLinear(byte / 255));
  const to = hexToBytes(stops[index + 1]).map((byte) => srgbToLinear(byte / 255));
  return from.map((start, channel) =>
    Math.round(linearToSrgb(start + (to[channel] - start) * fraction) * 255),
  );
}

export function paletteImage(rows, stopsByRow, width = PALETTE_WIDTH) {
  const data = new Uint8Array(width * rows.length * 4);
  rows.forEach((row, y) => {
    const stops = stopsByRow[row] ?? ['#000000'];
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(stops, x / (width - 1));
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  });
  return { width, height: rows.length, data };
}

export function kitAnchors(gltf) {
  const anchors = {};
  for (const node of gltf.nodes ?? []) {
    const [part, anchor] = node.name.split(ANCHOR_SEPARATOR);
    if (!anchor) continue;
    anchors[part] ??= {};
    anchors[part][anchor] = {
      position: node.translation ?? [0, 0, 0],
      scale: node.scale ?? [1, 1, 1],
    };
  }
  return anchors;
}

function socketOf(anchors, desk, socket) {
  const found = anchors[desk]?.[socket];
  if (!found) throw new Error(`${desk} has no ${socket}`);
  return found.position;
}

export function stationPlan(variants, anchors) {
  const desk = `desk_${variants.desk}`;
  const place = (slot, socket) => ({
    slot,
    part: `${slot}_${variants[slot]}`,
    position: socketOf(anchors, desk, socket),
  });
  return [
    { slot: 'desk', part: desk, position: [0, 0, 0] },
    ...STATION_SLOTS.map((slot) => place(slot, `socket_${slot}`)),
    ...SPEAKER_SOCKETS.map((socket) => place('speaker', socket)),
  ];
}

function rotateY([x, y, z], yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [x * cos + z * sin, y, z * cos - x * sin];
}

function snap(value) {
  return Math.round(value * PRECISION) / PRECISION + 0;
}

export function shopPlan(recipe, anchors) {
  const [width, depth] = recipe.layout.cells;
  const station = stationPlan(recipe.variants, anchors);
  return recipe.layout.stations.flatMap(({ cell: [cx, cz], facing }, index) => {
    const yaw = YAW[facing];
    const originX = (cx - (width - 1) / 2) * CELL_SIZE;
    const originZ = (cz - (depth - 1) / 2) * CELL_SIZE;
    return station.map(({ slot, part, position }) => {
      const [dx, dy, dz] = rotateY(position, yaw);
      return {
        station: index,
        slot,
        part,
        position: [snap(originX + dx), snap(dy), snap(originZ + dz)],
        yaw,
      };
    });
  });
}

export function instanceGroups(plan) {
  const groups = new Map();
  for (const placement of plan) {
    if (!groups.has(placement.part)) groups.set(placement.part, []);
    groups.get(placement.part).push(placement);
  }
  return groups;
}

export function drawCalls(gltf, plan) {
  const meshOf = new Map(
    (gltf.nodes ?? [])
      .filter((node) => node.mesh !== undefined)
      .map((node) => [node.name, gltf.meshes[node.mesh]]),
  );
  let calls = 0;
  for (const part of instanceGroups(plan).keys()) {
    calls += meshOf.get(part)?.primitives.length ?? 0;
  }
  return calls;
}
