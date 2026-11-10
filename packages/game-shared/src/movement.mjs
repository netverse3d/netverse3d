export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 1.8;
export const RUN_SPEED = 4.2;

const MAX_STRIDE = PLAYER_RADIUS / 2;
const SEPARATION_PASSES = 4;

function clampedIntent(intent) {
  const length = Math.hypot(intent.x, intent.z);
  if (length === 0) return null;
  const scale = length > 1 ? 1 / length : 1;
  return { x: intent.x * scale, z: intent.z * scale };
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function pushOutOfBox(point, box, radius) {
  const nearestX = clamp(point.x, box.minX, box.maxX);
  const nearestZ = clamp(point.z, box.minZ, box.maxZ);
  const offsetX = point.x - nearestX;
  const offsetZ = point.z - nearestZ;
  const gap = Math.hypot(offsetX, offsetZ);
  if (gap >= radius) return false;
  if (gap > 0) {
    const push = (radius - gap) / gap;
    point.x += offsetX * push;
    point.z += offsetZ * push;
    return true;
  }
  const exits = [
    { depth: point.x - box.minX, x: box.minX - radius, z: point.z },
    { depth: box.maxX - point.x, x: box.maxX + radius, z: point.z },
    { depth: point.z - box.minZ, x: point.x, z: box.minZ - radius },
    { depth: box.maxZ - point.z, x: point.x, z: box.maxZ + radius },
  ];
  const nearest = exits.reduce((best, exit) => (exit.depth < best.depth ? exit : best));
  point.x = nearest.x;
  point.z = nearest.z;
  return true;
}

function separate(point, obstacles, radius) {
  for (let pass = 0; pass < SEPARATION_PASSES; pass += 1) {
    let moved = false;
    for (const box of obstacles) moved = pushOutOfBox(point, box, radius) || moved;
    if (!moved) return;
  }
}

export function stepPlayer(player, intent, obstacles, seconds) {
  const direction = clampedIntent(intent);
  if (!direction || seconds <= 0) return { x: player.x, z: player.z, yaw: player.yaw };
  const speed = intent.run ? RUN_SPEED : WALK_SPEED;
  const travelX = direction.x * speed * seconds;
  const travelZ = direction.z * speed * seconds;
  const strides = Math.max(1, Math.ceil(Math.hypot(travelX, travelZ) / MAX_STRIDE));
  const point = { x: player.x, z: player.z };
  for (let stride = 0; stride < strides; stride += 1) {
    point.x += travelX / strides;
    point.z += travelZ / strides;
    separate(point, obstacles, PLAYER_RADIUS);
  }
  return { x: point.x, z: point.z, yaw: Math.atan2(direction.x, direction.z) };
}
