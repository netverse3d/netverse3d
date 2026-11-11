import { anchorOnFloor, collisionBoxes } from '@netverse/game-shared/collision';
import type { KitAnchors } from '@netverse/game-shared/collision';
import type { FloorBox, FloorPoint, PlayerState } from '@netverse/game-shared/movement';
import { seatIdOf, withinSeatReach } from '@netverse/game-shared/seating';

export interface StationPart {
  readonly station?: number;
  readonly slot: string;
  readonly part: string;
  readonly position: readonly number[];
  readonly yaw: number;
}

export interface ChairMount {
  readonly part: string;
  readonly index: number;
  readonly position: readonly number[];
  readonly yaw: number;
}

export interface Seat {
  readonly seatId: string;
  readonly mount: ChairMount;
  readonly chair: FloorPoint;
  readonly footprint: FloorBox;
  readonly sit: PlayerState;
}

const DESK_SLOT = 'desk';
const CHAIR_SLOT = 'chair';
const SIT_ANCHOR = 'seat_anchor';

function around(boxes: readonly FloorBox[], owner: string): FloorBox {
  if (boxes.length === 0) throw new TypeError(`${owner} has no collision box`);
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    minZ: Math.min(...boxes.map((box) => box.minZ)),
    maxZ: Math.max(...boxes.map((box) => box.maxZ)),
  };
}

function span(from: FloorPoint, to: FloorPoint): number {
  return Math.sqrt((from.x - to.x) ** 2 + (from.z - to.z) ** 2);
}

export function shopSeats(stations: readonly StationPart[], anchors: KitAnchors): Seat[] {
  return stations
    .filter((placed) => placed.slot === DESK_SLOT)
    .map(({ station, part }) => {
      if (station === undefined) throw new TypeError(`${part} belongs to no station`);
      const parts = stations.filter((placed) => placed.station === station);
      const chair = parts.find((placed) => placed.slot === CHAIR_SLOT);
      if (!chair) throw new TypeError(`${part} has no chair in its station`);
      const footprint = around(collisionBoxes(parts, anchors), part);
      const [x = 0, , z = 0] = chair.position;
      const hip = anchors[chair.part]?.[SIT_ANCHOR];
      if (!hip) throw new TypeError(`${chair.part} has no ${SIT_ANCHOR}`);
      const sit = { ...anchorOnFloor(chair, hip, `${chair.part} ${SIT_ANCHOR}`), yaw: chair.yaw };
      const mount = {
        part: chair.part,
        index: stations.filter((placed) => placed.part === chair.part).indexOf(chair),
        position: chair.position,
        yaw: chair.yaw,
      };
      return { seatId: seatIdOf(station), mount, chair: { x, z }, footprint, sit };
    });
}

export function nearestSeat(
  player: FloorPoint,
  seats: readonly Seat[],
  taken: ReadonlySet<string>,
): Seat | null {
  let best: Seat | null = null;
  for (const seat of seats) {
    if (taken.has(seat.seatId) || !withinSeatReach(player, seat.footprint)) continue;
    if (best === null) {
      best = seat;
      continue;
    }
    const lead = span(seat.chair, player) - span(best.chair, player);
    const earlier = seat.seatId.localeCompare(best.seatId, 'en', { numeric: true }) < 0;
    if (lead < 0 || (lead === 0 && earlier)) best = seat;
  }
  return best;
}
