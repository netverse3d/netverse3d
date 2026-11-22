import { STREET_CELL, lotFrontage, roadLane } from './street-look.mjs';

const VEHICLE_Y = 0;
const PARKED_BIKE_OFFSET = 1.15;
const PARKED_CAR_OFFSET = 1.8;

function roadWidthAtFrontage(block, lot) {
  const { centre, outward } = lotFrontage(lot, block);
  const roads = roadLane(block);
  let width = 0;
  for (let step = 0; step < 4; step += 1) {
    const targetX = centre[0] + outward[0] * (STREET_CELL / 2 + step * STREET_CELL);
    const targetZ = centre[1] + outward[1] * (STREET_CELL / 2 + step * STREET_CELL);
    if (
      !roads.some(
        ([x, z]) =>
          Math.abs(x - targetX) <= STREET_CELL / 2 && Math.abs(z - targetZ) <= STREET_CELL / 2,
      )
    )
      break;
    width += STREET_CELL;
  }
  return width;
}

export function parkedVehiclePlacements(block) {
  return (block.lots ?? []).flatMap((lot) => {
    if (!lot.shop || roadWidthAtFrontage(block, lot) < STREET_CELL) return [];
    const { centre, outward, along } = lotFrontage(lot, block);
    const wide = roadWidthAtFrontage(block, lot) >= STREET_CELL * 2;
    const specs = wide
      ? [{ slot: 'car', variant: 'a', offset: -1.35, depth: PARKED_CAR_OFFSET }]
      : [
          { slot: 'motorbike', variant: 'a', offset: 1.15, depth: PARKED_BIKE_OFFSET },
          { slot: 'motorbike', variant: 'b', offset: 3.05, depth: PARKED_BIKE_OFFSET },
        ];
    return specs.map(({ slot, variant, offset, depth }, index) => ({
      slot,
      part: `${slot}_${variant}`,
      lot: lot.id,
      id: `${lot.id}:${slot}-${index}`,
      position: [
        centre[0] + along[0] * offset + outward[0] * depth,
        VEHICLE_Y,
        centre[1] + along[1] * offset + outward[1] * depth,
      ],
      yaw: Math.atan2(along[0], along[1]),
    }));
  });
}

export function wheelSpinAngle(distance, radius) {
  if (!(radius > 0)) throw new RangeError('wheel radius must be positive');
  return distance / radius;
}

export function createTrafficLane(
  block,
  { duration = 14, count = 1, minimumGap = 5.4, lateralOffset = 0 } = {},
) {
  if (!(duration > 0) || !Number.isInteger(count) || count < 1)
    throw new RangeError('duration and count must be positive');
  const points = roadLane(block);
  if (points.length < 2) throw new RangeError('a lane needs at least two road cells');
  const segments = [];
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const distance = Math.hypot(dx, dz);
    if (distance !== STREET_CELL || (dx !== 0 && dz !== 0))
      throw new RangeError('lane road cells must be adjacent');
    segments.push({ from, dx, dz, start: length, end: length + distance });
    length += distance;
  }
  if (length / count < minimumGap) throw new RangeError('lane is too short for vehicle spacing');
  const positionAt = (time, index = 0, out = null) => {
    if (!Number.isInteger(index) || index < 0 || index >= count)
      throw new RangeError('vehicle index is outside lane');
    const cycles = time / duration + index / count;
    const phase = ((cycles % 1) + 1) % 1;
    const distance = phase * length;
    let segment = segments[segments.length - 1];
    for (let position = 0; position < segments.length; position += 1) {
      if (distance < segments[position].end) {
        segment = segments[position];
        break;
      }
    }
    const fraction = (distance - segment.start) / (segment.end - segment.start);
    const state = out ?? { position: [0, VEHICLE_Y, 0] };
    state.position[0] =
      segment.from[0] + segment.dx * fraction - (segment.dz / STREET_CELL) * lateralOffset;
    state.position[1] = VEHICLE_Y;
    state.position[2] =
      segment.from[1] + segment.dz * fraction + (segment.dx / STREET_CELL) * lateralOffset;
    state.yaw = Math.atan2(segment.dx, segment.dz);
    state.distance = distance;
    state.travelled = Math.max(0, cycles * length);
    return state;
  };
  return { length, duration, count, minimumGap, points, positionAt };
}
