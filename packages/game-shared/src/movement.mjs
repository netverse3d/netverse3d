export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 1.8;
export const RUN_SPEED = 4.2;
export const MAX_STEP_SECONDS = 0.25;

const MAX_STRIDE = PLAYER_RADIUS / 2;
const SEPARATION_PASSES = 8;
const OVERLAP_TOLERANCE = 1e-9;

function length(x, z) {
  return Math.sqrt(x * x + z * z);
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function clampedIntent(intent) {
  if (!Number.isFinite(intent.x) || !Number.isFinite(intent.z)) return null;
  const size = length(intent.x, intent.z);
  if (size === 0) return null;
  const scale = size > 1 ? 1 / size : 1;
  return { x: intent.x * scale, z: intent.z * scale };
}

function clampedSeconds(seconds) {
  if (Number.isNaN(seconds) || !(seconds > 0)) return 0;
  return Math.min(seconds, MAX_STEP_SECONDS);
}

function overlapWith(point, box, radius) {
  const offsetX = point.x - clamp(point.x, box.minX, box.maxX);
  const offsetZ = point.z - clamp(point.z, box.minZ, box.maxZ);
  const gap = length(offsetX, offsetZ);
  if (!(gap < radius)) return null;
  if (gap > 0) {
    const depth = radius - gap;
    return { depth, x: point.x + (offsetX / gap) * depth, z: point.z + (offsetZ / gap) * depth };
  }
  const exits = [
    { depth: point.x - box.minX, x: box.minX - radius, z: point.z },
    { depth: box.maxX - point.x, x: box.maxX + radius, z: point.z },
    { depth: point.z - box.minZ, x: point.x, z: box.minZ - radius },
    { depth: box.maxZ - point.z, x: point.x, z: box.maxZ + radius },
  ];
  const nearest = exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best));
  return { depth: nearest.depth + radius, x: nearest.x, z: nearest.z };
}

function deepestOverlap(point, obstacles, radius) {
  let deepest = null;
  for (const box of obstacles) {
    const overlap = overlapWith(point, box, radius);
    if (overlap && overlap.depth > OVERLAP_TOLERANCE && (!deepest || overlap.depth > deepest.depth))
      deepest = overlap;
  }
  return deepest;
}

function separated(point, obstacles, radius) {
  let current = point;
  for (let pass = 0; pass < SEPARATION_PASSES; pass += 1) {
    const overlap = deepestOverlap(current, obstacles, radius);
    if (!overlap) return current;
    current = { x: overlap.x, z: overlap.z };
  }
  return deepestOverlap(current, obstacles, radius) ? null : current;
}

export function stepPlayer(player, intent, obstacles, seconds) {
  const direction = clampedIntent(intent);
  const duration = clampedSeconds(seconds);
  let point = separated(player, obstacles, PLAYER_RADIUS) ?? { x: player.x, z: player.z };
  if (!direction || duration === 0) return { x: point.x, z: point.z, yaw: player.yaw };
  const speed = intent.run ? RUN_SPEED : WALK_SPEED;
  const travelX = direction.x * speed * duration;
  const travelZ = direction.z * speed * duration;
  const strides = Math.max(1, Math.ceil(length(travelX, travelZ) / MAX_STRIDE));
  for (let stride = 0; stride < strides; stride += 1) {
    const next = separated(
      { x: point.x + travelX / strides, z: point.z + travelZ / strides },
      obstacles,
      PLAYER_RADIUS,
    );
    if (!next) break;
    point = next;
  }
  return { x: point.x, z: point.z, yaw: Math.atan2(direction.x, direction.z) };
}
