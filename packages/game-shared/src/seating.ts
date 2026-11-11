import { PLAYER_RADIUS } from './movement.ts';
import type { FloorBox, FloorPoint } from './movement.ts';

export const SEAT_REACH = PLAYER_RADIUS + 0.2;

export function seatIdOf(station: number): string {
  if (!Number.isInteger(station) || station < 0) {
    throw new TypeError('Station index must be a non-negative integer');
  }
  return `seat-${station + 1}`;
}

export function gapToBox(box: FloorBox, point: FloorPoint): number {
  const gapX = Math.max(box.minX - point.x, 0, point.x - box.maxX);
  const gapZ = Math.max(box.minZ - point.z, 0, point.z - box.maxZ);
  return Math.sqrt(gapX * gapX + gapZ * gapZ);
}

export function withinSeatReach(point: FloorPoint, footprint: FloorBox): boolean {
  return gapToBox(footprint, point) <= SEAT_REACH;
}
