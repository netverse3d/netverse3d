import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  applyServerMessage,
  emptyRoom,
  joinMessage,
  moveMessage,
  readServerMessage,
  seatLeaveMessage,
  seatRequestMessage,
  withoutDenial,
  type RoomState,
} from './room-protocol.ts';

const SCHEMA = fileURLToPath(
  import.meta.resolve('@netverse/contracts/realtime/v1/protocol.schema.json'),
);
const matchesProtocol = new Ajv2020({ strict: false, allErrors: true }).compile(
  JSON.parse(readFileSync(SCHEMA, 'utf8')),
);

const AN = { playerId: 'an', position: { x: 1, y: 0, z: 2 }, yaw: 0.5, seatId: null };
const BINH = { playerId: 'binh', position: { x: 3, y: 0, z: 4 }, yaw: 1, seatId: 'seat-2' };

function snapshot(tick: number, players: object[]): object {
  return { kind: 'snapshot', tick, players };
}

function received(room: RoomState, message: object): RoomState {
  const read = readServerMessage(JSON.stringify(message));
  assert.ok(read, `rejected ${JSON.stringify(message)}`);
  return applyServerMessage(room, read);
}

function seatedPlayers(room: RoomState): [string, string][] {
  return [...room.players.values()].flatMap((player): [string, string][] =>
    player.seatId === null ? [] : [[player.seatId, player.playerId]],
  );
}

function assertSeatsMatchPlayers(room: RoomState): void {
  assert.deepEqual([...room.seats].sort(), seatedPlayers(room).sort());
}

test('mọi thông điệp client dựng ra đều đúng giao thức nháp', () => {
  const messages = [
    joinMessage('tim-neon', 'guest-ticket'),
    moveMessage(7, { x: 1.5, z: -2, yaw: 0.25 }),
    seatRequestMessage('seat-1'),
    seatLeaveMessage(),
  ];
  for (const message of messages) {
    assert.ok(matchesProtocol(message), JSON.stringify(matchesProtocol.errors));
  }
});

test('thông điệp di chuyển đặt người chơi trên mặt sàn', () => {
  assert.deepEqual(moveMessage(3, { x: 1, z: 2, yaw: 0.5 }), {
    kind: 'move',
    sequence: 3,
    position: { x: 1, y: 0, z: 2 },
    yaw: 0.5,
  });
});

test('không dựng được thông điệp client trái giao thức', () => {
  const missingYaw = { x: 1, z: 1 } as unknown as { x: number; z: number; yaw: number };
  assert.throws(() => moveMessage(0, { x: NaN, z: 1, yaw: 0 }), /player\.x/);
  assert.throws(() => moveMessage(0, { x: 1, z: Infinity, yaw: 0 }), /player\.z/);
  assert.throws(() => moveMessage(0, missingYaw), /player\.yaw/);
  assert.throws(() => moveMessage(-1, { x: 1, z: 1, yaw: 0 }), /sequence/);
  assert.throws(() => moveMessage(1.5, { x: 1, z: 1, yaw: 0 }), /sequence/);
  assert.throws(() => joinMessage('tim-neon', undefined as unknown as string), /ticket/);
  assert.throws(() => joinMessage('', 'guest-ticket'), /shopId/);
  assert.throws(() => seatRequestMessage(7 as unknown as string), /seatId/);
});

test('các thông điệp server mẫu đều đúng giao thức nháp và đọc lại nguyên vẹn', () => {
  const messages = [
    snapshot(1, [AN, BINH]),
    { kind: 'delta', tick: 2, changed: [AN], left: ['binh'] },
    { kind: 'seat.granted', seatId: 'seat-1', playerId: 'an' },
    { kind: 'seat.denied', seatId: 'seat-1', reason: 'occupied' },
    { kind: 'error', code: 'room_full', message: 'Room is full' },
  ];
  for (const message of messages) {
    assert.ok(matchesProtocol(message), JSON.stringify(matchesProtocol.errors));
    assert.deepEqual(readServerMessage(JSON.stringify(message)), message);
  }
});

test('người chơi trong phòng mang hình dạng của luật chơi, không phải của đường truyền', () => {
  const room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  assert.deepEqual(room.players.get('an'), { playerId: 'an', x: 1, z: 2, yaw: 0.5, seatId: null });
  assert.deepEqual(room.players.get('binh'), {
    playerId: 'binh',
    x: 3,
    z: 4,
    yaw: 1,
    seatId: 'seat-2',
  });
});

test('snapshot thay toàn bộ danh sách người chơi và máy đang bận', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  assert.deepEqual([...room.players.keys()], ['an', 'binh']);
  assert.equal(room.seats.get('seat-2'), 'binh');
  room = received(room, snapshot(2, [AN]));
  assert.deepEqual([...room.players.keys()], ['an']);
  assert.equal(room.seats.size, 0);
  assert.equal(room.tick, 2);
});

test('snapshot luôn được nhận kể cả khi tick nhỏ hơn, để server khởi động lại vẫn đồng bộ được', () => {
  let room = received(emptyRoom(), snapshot(900, [AN, BINH]));
  room = received(room, snapshot(1, [AN]));
  assert.equal(room.tick, 1);
  assert.deepEqual([...room.players.keys()], ['an']);
});

test('delta chỉ đổi người được nhắc tới và bỏ người đã rời', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  const moved = { ...AN, position: { x: 9, y: 0, z: 9 } };
  room = received(room, { kind: 'delta', tick: 2, changed: [moved], left: ['binh'] });
  assert.equal(room.players.get('an')?.x, 9);
  assert.equal(room.players.has('binh'), false);
  assert.equal(room.seats.has('seat-2'), false);
  assert.equal(room.tick, 2);
});

test('nhiều delta cùng một tick đều được áp', () => {
  let room = received(emptyRoom(), snapshot(2, [AN, BINH]));
  room = received(room, { kind: 'delta', tick: 2, left: ['binh'] });
  room = received(room, { kind: 'delta', tick: 2, changed: [{ ...AN, yaw: 2 }] });
  assert.equal(room.players.has('binh'), false);
  assert.equal(room.players.get('an')?.yaw, 2);
});

test('delta cũ hơn trạng thái đang có thì bị bỏ qua và phòng giữ nguyên', () => {
  const room = received(emptyRoom(), snapshot(5, [AN]));
  const stale = { ...AN, position: { x: 9, y: 0, z: 9 } };
  assert.equal(received(room, { kind: 'delta', tick: 4, changed: [stale] }), room);
});

test('người chơi đứng dậy trong delta thì máy trống lại', () => {
  let room = received(emptyRoom(), snapshot(1, [BINH]));
  room = received(room, { kind: 'delta', tick: 2, changed: [{ ...BINH, seatId: null }] });
  assert.equal(room.seats.size, 0);
});

test('được cấp máy thì người đó ngồi vào máy và nhả máy cũ', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  room = received(room, { kind: 'seat.granted', seatId: 'seat-1', playerId: 'binh' });
  assert.equal(room.players.get('binh')?.seatId, 'seat-1');
  assert.deepEqual([...room.seats], [['seat-1', 'binh']]);
});

test('danh sách máy bận luôn khớp với chỗ ngồi ghi trên từng người chơi', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  assertSeatsMatchPlayers(room);
  room = received(room, { kind: 'seat.granted', seatId: 'seat-2', playerId: 'an' });
  assert.equal(room.players.get('binh')?.seatId, null);
  assertSeatsMatchPlayers(room);
  room = received(room, { kind: 'delta', tick: 2, changed: [{ ...BINH, seatId: null }] });
  assert.equal(room.seats.get('seat-2'), 'an');
  assertSeatsMatchPlayers(room);
  room = received(
    room,
    snapshot(3, [
      { ...AN, seatId: 'seat-1' },
      { ...BINH, seatId: 'seat-1' },
    ]),
  );
  assert.deepEqual([...room.seats], [['seat-1', 'binh']]);
  assertSeatsMatchPlayers(room);
});

test('cấp máy cho người không có trong phòng thì phòng giữ nguyên', () => {
  const room = received(emptyRoom(), snapshot(1, [AN]));
  assert.equal(
    received(room, { kind: 'seat.granted', seatId: 'seat-1', playerId: 'nobody' }),
    room,
  );
  assert.equal(
    received(emptyRoom(), { kind: 'seat.granted', seatId: 'seat-1', playerId: 'an' }).seats.size,
    0,
  );
});

test('bị từ chối máy thì giữ lại lý do cho tới khi được gỡ, người khác được cấp máy không gỡ hộ', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  room = received(room, { kind: 'seat.denied', seatId: 'seat-2', reason: 'occupied' });
  assert.deepEqual(room.denied, { seatId: 'seat-2', reason: 'occupied' });
  assert.equal(room.seats.get('seat-2'), 'binh');
  room = received(room, { kind: 'seat.granted', seatId: 'seat-1', playerId: 'binh' });
  assert.deepEqual(room.denied, { seatId: 'seat-2', reason: 'occupied' });
  assert.equal(withoutDenial(room).denied, null);
  assert.equal(withoutDenial(emptyRoom()).denied, null);
});

test('lỗi từ server được giữ lại cho tới lần đồng bộ thành công kế tiếp', () => {
  let room = received(emptyRoom(), { kind: 'error', code: 'room_full', message: 'Room is full' });
  assert.deepEqual(room.error, { code: 'room_full', message: 'Room is full' });
  room = received(room, { kind: 'error', code: 'kicked' });
  assert.deepEqual(room.error, { code: 'kicked' });
  room = received(room, { kind: 'delta', tick: 1 });
  assert.deepEqual(room.error, { code: 'kicked' });
  room = received(room, snapshot(2, [AN]));
  assert.equal(room.error, null);
});

test('không sửa trạng thái phòng đầu vào', () => {
  const room = received(emptyRoom(), snapshot(1, [AN]));
  received(room, { kind: 'delta', tick: 2, left: ['an'] });
  received(room, { kind: 'seat.granted', seatId: 'seat-1', playerId: 'an' });
  assert.equal(room.players.get('an')?.seatId, null);
  assert.equal(room.seats.size, 0);
  assert.equal(room.tick, 1);
});

test('văn bản hỏng hoặc thông điệp sai hình dạng thì bị từ chối', () => {
  const broken = [
    'not json',
    '42',
    'null',
    '[]',
    JSON.stringify({ kind: 'teleport' }),
    JSON.stringify({ kind: 'join', shopId: 'tim-neon', ticket: 'guest-ticket' }),
    JSON.stringify({ kind: 'snapshot', tick: 1 }),
    JSON.stringify({ kind: 'snapshot', tick: -1, players: [] }),
    JSON.stringify({ kind: 'snapshot', tick: 1.5, players: [] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ playerId: 'an', yaw: 0 }] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ ...AN, yaw: 'north' }] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ ...AN, playerId: 7 }] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ ...AN, position: { x: 1, y: 0 } }] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ ...AN, position: { x: 1, z: 0 } }] }),
    JSON.stringify({ kind: 'snapshot', tick: 1, players: [{ ...AN, seatId: 4 }] }),
    JSON.stringify({ kind: 'delta', tick: 1, left: [7] }),
    JSON.stringify({ kind: 'delta', tick: 1, changed: 'an' }),
    JSON.stringify({ kind: 'delta', tick: 1, changed: [{ playerId: 'an' }] }),
    JSON.stringify({ kind: 'seat.granted', seatId: 'seat-1' }),
    JSON.stringify({ kind: 'seat.granted', seatId: 'seat-1', playerId: 7 }),
    JSON.stringify({ kind: 'seat.denied', seatId: 'seat-1', reason: 'bored' }),
    JSON.stringify({ kind: 'seat.denied', reason: 'occupied' }),
    JSON.stringify({ kind: 'error' }),
    JSON.stringify({ kind: 'error', code: 'room_full', message: 7 }),
  ];
  for (const text of broken) {
    assert.equal(readServerMessage(text), null, text);
    const parsed: unknown = text === 'not json' ? null : JSON.parse(text);
    assert.equal(matchesProtocol(parsed) && isServerKind(parsed), false, text);
  }
});

function isServerKind(value: unknown): boolean {
  const kinds = ['snapshot', 'delta', 'seat.granted', 'seat.denied', 'error'];
  return (
    typeof value === 'object' && value !== null && kinds.includes((value as { kind: string }).kind)
  );
}

test('tên người chơi trùng tên thuộc tính có sẵn của đối tượng vẫn được giữ như dữ liệu', () => {
  const room = received(emptyRoom(), snapshot(1, [{ ...AN, playerId: '__proto__' }]));
  assert.equal(room.players.get('__proto__')?.x, 1);
});

test('phòng mới chưa nhận gì có tick âm một', () => {
  assert.equal(emptyRoom().tick, -1);
});

test('người chơi không có khoá seatId trên đường truyền được hiểu là không ngồi máy nào', () => {
  const standing = { playerId: 'binh', position: { x: 3, y: 0, z: 4 }, yaw: 1 };
  let room = received(emptyRoom(), snapshot(1, [BINH]));
  room = received(room, { kind: 'delta', tick: 2, changed: [standing] });
  assert.equal(room.players.get('binh')?.seatId, null);
  assert.equal(room.seats.size, 0);
});

test('người vừa đổi vừa rời trong cùng một delta thì coi như đã rời', () => {
  let room = received(emptyRoom(), snapshot(1, [AN, BINH]));
  room = received(room, { kind: 'delta', tick: 2, changed: [BINH], left: ['binh'] });
  assert.equal(room.players.has('binh'), false);
  assert.equal(room.seats.size, 0);
});

test('lý do bị từ chối sống qua snapshot, chỉ được gỡ lúc xin máy lại', () => {
  let room = received(emptyRoom(), { kind: 'seat.denied', seatId: 'seat-1', reason: 'no_balance' });
  room = received(room, snapshot(2, [AN]));
  assert.deepEqual(room.denied, { seatId: 'seat-1', reason: 'no_balance' });
});

test('không còn gì để gỡ thì gỡ lý do từ chối trả lại đúng phòng cũ', () => {
  const room = received(emptyRoom(), snapshot(1, [AN]));
  assert.equal(withoutDenial(room), room);
});

test('thông điệp thiếu hoặc sai kiểu ở từng trường bắt buộc đều bị từ chối', () => {
  const broken = [
    { kind: 'delta' },
    { kind: 'delta', tick: -1 },
    { kind: 'delta', tick: 0.5 },
    { kind: 'seat.granted', playerId: 'an' },
    { kind: 'seat.granted', seatId: 7, playerId: 'an' },
    { kind: 'error', code: 7 },
    { kind: 'snapshot', tick: 1, players: [{ ...AN, position: { y: 0, z: 2 } }] },
  ];
  for (const message of broken) {
    assert.equal(readServerMessage(JSON.stringify(message)), null, JSON.stringify(message));
    assert.equal(matchesProtocol(message), false, JSON.stringify(message));
  }
});
