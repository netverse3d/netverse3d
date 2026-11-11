import { rotateY } from '../../runtime/shop-look.mjs';

export const STATION_KIT = 'station-parts.glb';
export const CLEARANCE_LEVELS = ['sunk', 'touching', 'floating'];

const COLLISION_PREFIX = 'collision_';
const SEATED_CLIP_ORDER = ['typing', 'sit_idle', 'sit_down', 'stand_up'];
const SUNK_BELOW = -0.001;
const DEFAULT_REACH = 0.04;
const HAND_REACH = 0.12;
const OFF_DESK_BELOW = -0.06;
const FOOT_ZONE = { side: 0.115, halfWidth: 0.055, back: -0.05, front: 0.17, top: 0.11 };

export function stationChoices(config) {
  const kit = (config.kits ?? []).find((item) => item.file === STATION_KIT);
  return Object.entries(kit?.slots ?? {}).map(([slot, spec]) => ({
    slot,
    variants: [...spec.variants],
  }));
}

export function withVariant(variants, slot, variant) {
  return { ...variants, [slot]: variant };
}

export function seatPoint(chair, hip) {
  const yaw = chair.yaw ?? 0;
  const [dx, , dz] = rotateY(hip.position, yaw);
  return { x: chair.position[0] + dx, z: chair.position[2] + dz, yaw };
}

export function collisionOutlines(plan, anchors) {
  return plan.flatMap((placed) =>
    Object.entries(anchors[placed.part] ?? {})
      .filter(([name]) => name.startsWith(COLLISION_PREFIX))
      .map(([name, anchor]) => {
        const yaw = placed.yaw ?? 0;
        const offset = rotateY(anchor.position, yaw);
        return {
          part: placed.part,
          name,
          center: placed.position.map((value, axis) => value + offset[axis]),
          half: [...anchor.scale],
          yaw,
        };
      }),
  );
}

export function clearance(pointHeight, surfaceHeight, reach = DEFAULT_REACH) {
  const gap = pointHeight - surfaceHeight;
  const millimetres = Math.round(gap * 1000);
  if (gap < SUNK_BELOW) return { millimetres, level: 'sunk' };
  return { millimetres, level: gap > reach ? 'floating' : 'touching' };
}

export function handReading(point, keyboard, deskHeight) {
  const overKeys =
    Math.abs(point.x - keyboard.x) <= keyboard.halfWidth &&
    Math.abs(point.z - keyboard.z) <= keyboard.halfDepth;
  if (overKeys) return { surface: 'keyboard', ...clearance(point.y, keyboard.height, HAND_REACH) };
  if (point.y - deskHeight < OFF_DESK_BELOW)
    return { surface: 'desk', millimetres: null, level: 'away' };
  return { surface: 'desk', ...clearance(point.y, deskHeight, HAND_REACH) };
}

export function footZoneHits(triangles, hip) {
  const inZone = ([x, y, z]) =>
    y <= FOOT_ZONE.top &&
    Math.abs(Math.abs(x - hip.position[0]) - FOOT_ZONE.side) <= FOOT_ZONE.halfWidth &&
    z - hip.position[2] >= FOOT_ZONE.back &&
    z - hip.position[2] <= FOOT_ZONE.front;
  return triangles.filter((triangle) => triangle.some(inZone)).length;
}

const THIGH = {
  side: 0.1,
  halfWidth: 0.045,
  hip: [-0.196, 0.405],
  knee: [0.082, 0.308],
  reach: 0.12,
};

export function thighSink(triangles, hip) {
  const [hipDepth, hipBottom] = THIGH.hip;
  const [kneeDepth, kneeBottom] = THIGH.knee;
  let sink = 0;
  for (const triangle of triangles) {
    for (const [x, y, z] of triangle) {
      const depth = z - hip.position[2];
      if (depth < hipDepth || depth > kneeDepth) continue;
      if (Math.abs(Math.abs(x - hip.position[0]) - THIGH.side) > THIGH.halfWidth) continue;
      const along = (depth - hipDepth) / (kneeDepth - hipDepth);
      const bottom = hipBottom + (kneeBottom - hipBottom) * along;
      if (y > bottom + THIGH.reach) continue;
      sink = Math.max(sink, y - bottom);
    }
  }
  return sink;
}

export function seatedClips(clips) {
  return SEATED_CLIP_ORDER.filter((name) => clips.includes(name));
}
