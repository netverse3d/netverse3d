import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLAYER_RADIUS } from '@netverse/game-shared/movement';

import { SEAT_REACH, nearestSeat, shopSeats } from './seats.ts';
import type { Seat, StationPart } from './seats.ts';

const EAST = Math.PI / 2;
const NORTH = Math.PI;
const NOBODY: ReadonlySet<string> = new Set();

const ANCHORS = {
  desk_a: {
    interact_point: { position: [0, 0, -3], scale: [1, 1, 1] },
    socket_chair: { position: [0, 0, -0.24], scale: [1, 1, 1] },
    collision_main: { position: [0, 0.36, 0.46], scale: [0.76, 0.36, 0.35] },
  },
  desk_b: {
    socket_chair: { position: [0.1, 0, -1], scale: [1, 1, 1] },
    collision_main: { position: [0, 0.36, 0.46], scale: [0.5, 0.36, 0.3] },
  },
  chair_a: {
    seat_anchor: { position: [0, 0, 0.24], scale: [1, 1, 1] },
    collision_main: { position: [0, 0.66, -0.03], scale: [0.32, 0.66, 0.33] },
  },
  desk_bare: {
    socket_chair: { position: [0, 0, -0.24], scale: [1, 1, 1] },
  },
  desk_broken: {
    collision_main: { position: [0, 0.36, 0.46], scale: [0.76, 0.36, 0.35] },
  },
};

function part(
  station: number,
  slot: string,
  name: string,
  x: number,
  z: number,
  yaw = 0,
): StationPart {
  return { station, slot, part: name, position: [x, 0, z], yaw };
}

function station(index: number, x: number, z: number, yaw = 0): StationPart[] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [
    part(index, 'desk', 'desk_a', x, z, yaw),
    part(index, 'chair', 'chair_a', x - 0.24 * sin, z - 0.24 * cos, yaw),
    part(index, 'monitor', 'monitor_a', x, z, yaw),
  ];
}

function close(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} is not ${expected}`);
}

function seatAt(seatId: string, x: number, z: number): Seat {
  return {
    seatId,
    chair: { x, z },
    footprint: { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 },
  };
}

const TOUCHING = 0.5 + PLAYER_RADIUS;
const SEATS: Seat[] = [seatAt('seat-1', 0, 0), seatAt('seat-2', 4, 0), seatAt('seat-3', 1.6, 0)];

test('mỗi cụm máy cho một chỗ, tên chỗ đếm từ một theo thứ tự cụm trong tiệm', () => {
  const seats = shopSeats([...station(0, 0, 0), ...station(1, 4, 0)], ANCHORS);
  assert.deepEqual(
    seats.map((seat) => seat.seatId),
    ['seat-1', 'seat-2'],
  );
});

test('chỗ ngồi nằm ở đúng vị trí chiếc ghế của cụm máy, không dùng điểm tương tác của bàn', () => {
  const [south, east, north] = shopSeats(
    [...station(0, 2, 3, 0), ...station(1, 2, 3, EAST), ...station(2, 2, 3, NORTH)],
    ANCHORS,
  );
  close(south?.chair.x ?? NaN, 2, 'south x');
  close(south?.chair.z ?? NaN, 3 - 0.24, 'south z');
  close(east?.chair.x ?? NaN, 2 - 0.24, 'east x');
  close(east?.chair.z ?? NaN, 3, 'east z');
  close(north?.chair.x ?? NaN, 2, 'north x');
  close(north?.chair.z ?? NaN, 3 + 0.24, 'north z');
});

test('vùng của một cụm máy bao trọn hộp va chạm của bàn và ghế trong cụm đó, không lấn sang cụm khác', () => {
  const [first, second] = shopSeats([...station(0, 0, 0), ...station(1, 4, 0)], ANCHORS);
  assert.ok(first && second);
  close(first.footprint.minX, -0.76, 'minX');
  close(first.footprint.maxX, 0.76, 'maxX');
  close(first.footprint.minZ, -0.24 - 0.03 - 0.33, 'minZ');
  close(first.footprint.maxZ, 0.46 + 0.35, 'maxZ');
  assert.ok(second.footprint.minX > first.footprint.maxX);
});

test('vùng của cụm máy quay theo hướng đặt', () => {
  const [seat] = shopSeats(station(0, 0, 0, EAST), ANCHORS);
  assert.ok(seat);
  close(seat.footprint.maxX, 0.46 + 0.35, 'maxX');
  close(seat.footprint.minX, -0.24 - 0.03 - 0.33, 'minX');
  close(seat.footprint.minZ, -0.76, 'minZ');
  close(seat.footprint.maxZ, 0.76, 'maxZ');
});

test('cụm máy thiếu ghế, thiếu hộp va chạm hoặc bàn không thuộc cụm nào thì báo lỗi kèm tên bàn', () => {
  assert.throws(() => shopSeats([part(0, 'desk', 'desk_a', 0, 0)], ANCHORS), /desk_a/);
  assert.throws(
    () =>
      shopSeats(
        [part(0, 'desk', 'desk_bare', 0, 0), part(0, 'chair', 'stool_x', 0, -0.24)],
        ANCHORS,
      ),
    /desk_bare/,
  );
  assert.throws(
    () => shopSeats([{ slot: 'desk', part: 'desk_a', position: [0, 0, 0], yaw: 0 }], ANCHORS),
    /desk_a/,
  );
});

test('ghế của cụm khác không bị nhận nhầm', () => {
  const [first, second] = shopSeats([...station(0, 0, 0), ...station(1, 4, 0)], ANCHORS);
  close(first?.chair.x ?? NaN, 0, 'first');
  close(second?.chair.x ?? NaN, 4, 'second');
});

test('đứng chạm vào bất kỳ cạnh nào của một cụm máy trống thì máy đó được gợi ý', () => {
  for (const [x, z] of [
    [4 + TOUCHING, 0],
    [4 - TOUCHING, 0.3],
    [4.2, TOUCHING],
    [3.9, -TOUCHING],
  ] as const) {
    assert.equal(nearestSeat({ x, z }, SEATS, NOBODY)?.seatId, 'seat-2', `${x},${z}`);
  }
});

test('ghế kê sát tường, người chơi chỉ chạm được mặt trước của bàn thì vẫn được gợi ý', () => {
  const [seat] = shopSeats(station(0, 0, -2, 0), ANCHORS);
  assert.ok(seat);
  const aisle = { x: 0.3, z: seat.footprint.maxZ + PLAYER_RADIUS };
  assert.equal(nearestSeat(aisle, [seat], NOBODY)?.seatId, 'seat-1');
});

test('đứng cách cụm máy quá một bước ngắn thì không có gợi ý', () => {
  const edge = 4 + 0.5 + SEAT_REACH;
  assert.equal(nearestSeat({ x: edge + 0.01, z: 0 }, SEATS, NOBODY), null);
  assert.equal(nearestSeat({ x: edge - 0.01, z: 0 }, SEATS, NOBODY)?.seatId, 'seat-2');
  assert.equal(nearestSeat({ x: 4 + 0.5 + 0.4, z: 0.5 + 0.4 }, SEATS, NOBODY), null);
});

test('máy đang bận thì không gợi ý, kể cả khi đứng ngay cạnh nó', () => {
  assert.equal(nearestSeat({ x: 4 + TOUCHING, z: 0 }, SEATS, new Set(['seat-2'])), null);
});

test('chạm hai cụm máy cùng lúc thì gợi ý máy có ghế gần hơn; máy đó bận thì gợi ý máy còn lại', () => {
  assert.equal(nearestSeat({ x: 0.7, z: 0.6 }, SEATS, NOBODY)?.seatId, 'seat-1');
  assert.equal(nearestSeat({ x: 0.9, z: 0.6 }, SEATS, NOBODY)?.seatId, 'seat-3');
  assert.equal(nearestSeat({ x: 0.7, z: 0.6 }, SEATS, new Set(['seat-1']))?.seatId, 'seat-3');
});

test('cách đều ghế của hai máy thì luôn chọn cùng một máy, không nhấp nháy giữa hai gợi ý', () => {
  const middle = { x: 0.8, z: 0.6 };
  assert.equal(nearestSeat(middle, SEATS, NOBODY)?.seatId, 'seat-1');
  assert.equal(nearestSeat(middle, [...SEATS].reverse(), NOBODY)?.seatId, 'seat-1');
});

test('tiệm chưa có máy nào thì không có gợi ý', () => {
  assert.equal(nearestSeat({ x: 0, z: 0 }, [], NOBODY), null);
});
