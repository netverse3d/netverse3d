export const PALETTE_WIDTH = 128;
const CELL_SIZE = 2;
const LIGHT_HEIGHT = 3.47;
const STATION_SLOTS = ['monitor', 'keyboard', 'mouse', 'mat', 'headset', 'mic', 'chair', 'case'];
const SIDE_SPEAKER_SOCKETS = ['socket_speaker_left', 'socket_speaker_right'];
const CENTER_SPEAKER_SOCKETS = ['socket_speaker_center'];
const CENTER_MOUNT = 'mount_center';
const YAW = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
const CORNER_YAW = {
  'south+west': 0,
  'east+south': Math.PI / 2,
  'east+north': Math.PI,
  'north+west': -Math.PI / 2,
};
const ANCHOR_SEPARATOR = '__';
const PRECISION = 1e4;

export function paletteRows(palette) {
  return [...palette.surface, ...palette.glow];
}

export function hexToBytes(hex) {
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
    if (node.mesh !== undefined) continue;
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
  const centred = anchors[`speaker_${variants.speaker}`]?.[CENTER_MOUNT] !== undefined;
  const speakerSockets = centred ? CENTER_SPEAKER_SOCKETS : SIDE_SPEAKER_SOCKETS;
  return [
    { slot: 'desk', part: desk, position: [0, 0, 0] },
    ...STATION_SLOTS.map((slot) => place(slot, `socket_${slot}`)),
    ...speakerSockets.map((socket) => place('speaker', socket)),
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

export function doorwayCell({ wall, at }, [width, depth]) {
  return { north: [at, 0], south: [at, depth - 1], west: [0, at], east: [width - 1, at] }[wall];
}

export function roomPlan(recipe) {
  const { cells, door, windows = [] } = recipe.layout;
  const [width, depth] = cells;
  const openings = new Map([
    [`${door.wall} ${door.at}`, 'door'],
    ...windows.map((opening) => [`${opening.wall} ${opening.at}`, 'window']),
  ]);
  const place = (slot, x, z, yaw) => ({
    slot,
    part: `${slot}_${recipe.variants[slot]}`,
    position: [snap((x - (width - 1) / 2) * CELL_SIZE), 0, snap((z - (depth - 1) / 2) * CELL_SIZE)],
    yaw,
  });
  const plan = [];
  for (let z = 0; z < depth; z += 1) {
    for (let x = 0; x < width; x += 1) {
      plan.push(place('floor', x, z, 0), place('ceiling', x, z, 0));
      const edges = [
        ...(z === 0 ? [['north', x]] : []),
        ...(z === depth - 1 ? [['south', x]] : []),
        ...(x === 0 ? [['west', z]] : []),
        ...(x === width - 1 ? [['east', z]] : []),
      ].map(([wall, at]) => ({ wall, slot: openings.get(`${wall} ${at}`) ?? 'wall' }));
      const key = edges
        .map((edge) => edge.wall)
        .sort()
        .join('+');
      const corner = CORNER_YAW[key] !== undefined && edges.every((edge) => edge.slot === 'wall');
      if (corner) {
        plan.push(place('corner', x, z, CORNER_YAW[key]));
      } else {
        for (const edge of edges) plan.push(place(edge.slot, x, z, YAW[edge.wall]));
      }
    }
  }
  return [...plan, ...ceilingLights(recipe)];
}

function ceilingLights(recipe) {
  const [width, depth] = recipe.layout.cells;
  const part = `light_${recipe.variants.light}`;
  const alongDepth = width === 1;
  const [seams, rows] = alongDepth ? [depth - 1, width] : [width - 1, depth];
  const [seamSpan, rowSpan] = alongDepth ? [depth, width] : [width, depth];
  const lights = [];
  for (let row = 0; row < rows; row += 1) {
    for (let seam = 0; seam < seams; seam += 1) {
      const across = snap((seam + 1 - seamSpan / 2) * CELL_SIZE);
      const along = snap((row - (rowSpan - 1) / 2) * CELL_SIZE);
      lights.push({
        slot: 'light',
        part,
        position: alongDepth ? [along, LIGHT_HEIGHT, across] : [across, LIGHT_HEIGHT, along],
        yaw: alongDepth ? Math.PI / 2 : 0,
      });
    }
  }
  return lights;
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
