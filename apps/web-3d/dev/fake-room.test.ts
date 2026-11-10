import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { createRoomClient } from '@netverse/game-shared/room-client';
import type { RoomClient, RoomConnection } from '@netverse/game-shared/room-client';

import { createFakeRoom } from './fake-room.ts';
import type { FakeRoom } from './fake-room.ts';

const SCHEMA = fileURLToPath(
  import.meta.resolve('@netverse/contracts/realtime/protocol.v1.schema.json'),
);
const matchesProtocol = new Ajv2020({ strict: false, allErrors: true }).compile(
  JSON.parse(readFileSync(SCHEMA, 'utf8')),
);

const SEATS = [
  { seatId: 'seat-1', footprint: { minX: -1, maxX: 1, minZ: 2, maxZ: 3 } },
  { seatId: 'seat-2', footprint: { minX: 4, maxX: 6, minZ: 2, maxZ: 3 } },
];
const BESIDE_FIRST = { x: 0, z: 1.6, yaw: 0 };
const BESIDE_SECOND = { x: 5, z: 1.6, yaw: 0 };
const FAR_AWAY = { x: 0, z: -4, yaw: 0 };

interface Guest {
  client: RoomClient;
  connection: RoomConnection;
  heard: unknown[];
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function guest(room: FakeRoom): Guest {
  const connection = room.connect();
  const heard: unknown[] = [];
  connection.listen((text) => heard.push(JSON.parse(text)));
  return { client: createRoomClient(connection), connection, heard };
}

async function joined(room: FakeRoom, ticket: string, at = BESIDE_FIRST): Promise<Guest> {
  const visitor = guest(room);
  visitor.client.join('tim-neon', ticket);
  visitor.client.move(at);
  await settle();
  return visitor;
}

function codes(visitor: Guest): string[] {
  return visitor.heard
    .filter((message): message is { kind: string; code: string } => {
      return (message as { kind?: string }).kind === 'error';
    })
    .map((message) => message.code);
}

test('vào phòng thì nhận ảnh chụp có chính mình, tên người chơi là vé đã gửi, chưa ngồi máy nào', async () => {
  const room = createFakeRoom(SEATS);
  const first = guest(room);
  first.client.join('tim-neon', 'guest-first');
  await settle();
  const state = first.client.room();
  assert.equal(state.tick, 0);
  assert.deepEqual([...state.players.keys()], ['guest-first']);
  assert.equal(state.players.get('guest-first')?.seatId, null);
  assert.equal(state.seats.size, 0);
});

test('thông điệp tới sau lời gọi gửi, không chen vào giữa lời gọi đó', () => {
  const room = createFakeRoom(SEATS);
  const first = guest(room);
  first.client.join('tim-neon', 'guest-first');
  assert.equal(first.heard.length, 0);
});

test('chưa vào phòng mà di chuyển hoặc xin máy thì bị báo lỗi, không đổi phòng', async () => {
  const room = createFakeRoom(SEATS);
  const first = guest(room);
  first.client.move(BESIDE_FIRST);
  first.client.requestSeat('seat-1');
  first.client.leaveSeat();
  await settle();
  assert.deepEqual(codes(first), ['not_joined', 'not_joined', 'not_joined']);
  assert.equal(first.client.room().players.size, 0);
});

test('đứng cạnh máy trống mà xin thì được cấp máy', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  first.client.requestSeat('seat-1');
  await settle();
  assert.equal(first.client.room().seats.get('seat-1'), 'guest-first');
  assert.equal(first.client.room().players.get('guest-first')?.seatId, 'seat-1');
  assert.equal(first.client.room().denied, null);
});

test('hai người xin cùng một máy thì người xin sau bị từ chối vì máy bận', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const second = await joined(room, 'guest-second');
  first.client.requestSeat('seat-1');
  second.client.requestSeat('seat-1');
  await settle();
  assert.equal(first.client.room().seats.get('seat-1'), 'guest-first');
  assert.deepEqual(second.client.room().denied, { seatId: 'seat-1', reason: 'occupied' });
  assert.equal(second.client.room().seats.get('seat-1'), 'guest-first');
  assert.equal(second.client.room().players.get('guest-second')?.seatId, null);
});

test('đứng xa máy mà xin thì bị từ chối vì quá xa, máy vẫn trống', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first', FAR_AWAY);
  first.client.requestSeat('seat-1');
  await settle();
  assert.deepEqual(first.client.room().denied, { seatId: 'seat-1', reason: 'too_far' });
  assert.equal(first.client.room().seats.size, 0);
});

test('vừa vào phòng chưa báo vị trí thì chưa đủ căn cứ để cấp máy', async () => {
  const room = createFakeRoom(SEATS);
  const first = guest(room);
  first.client.join('tim-neon', 'guest-first');
  first.client.requestSeat('seat-1');
  await settle();
  assert.deepEqual(first.client.room().denied, { seatId: 'seat-1', reason: 'too_far' });
});

test('xin máy không có trong tiệm thì bị báo lỗi', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  first.client.requestSeat('seat-99');
  await settle();
  assert.deepEqual(codes(first), ['unknown_seat']);
  assert.equal(first.client.room().seats.size, 0);
});

test('rời máy thì máy trống lại và người khác ngồi được', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const second = await joined(room, 'guest-second');
  first.client.requestSeat('seat-1');
  await settle();
  first.client.leaveSeat();
  await settle();
  assert.equal(second.client.room().seats.size, 0);
  second.client.requestSeat('seat-1');
  await settle();
  assert.equal(first.client.room().seats.get('seat-1'), 'guest-second');
});

test('đang ngồi thì báo di chuyển không làm đổi vị trí, và phải rời máy mới xin được máy khác', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  first.client.requestSeat('seat-1');
  await settle();
  first.client.move(BESIDE_SECOND);
  first.client.requestSeat('seat-2');
  await settle();
  const seated = first.client.room().players.get('guest-first');
  assert.equal(seated?.x, BESIDE_FIRST.x);
  assert.equal(seated?.seatId, 'seat-1');
  assert.deepEqual(codes(first), ['already_seated']);
  first.client.leaveSeat();
  first.client.move(BESIDE_SECOND);
  first.client.requestSeat('seat-2');
  await settle();
  assert.equal(first.client.room().seats.get('seat-2'), 'guest-first');
  assert.equal(first.client.room().seats.has('seat-1'), false);
});

test('rời máy lúc không ngồi máy nào thì không có gì xảy ra', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const before = first.heard.length;
  first.client.leaveSeat();
  await settle();
  assert.equal(first.heard.length, before);
});

test('người khác thấy mình di chuyển, ngồi xuống và rời phòng', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const second = await joined(room, 'guest-second', BESIDE_SECOND);
  assert.equal(first.client.room().players.get('guest-second')?.x, BESIDE_SECOND.x);
  second.client.requestSeat('seat-2');
  await settle();
  assert.equal(first.client.room().seats.get('seat-2'), 'guest-second');
  second.client.close();
  await settle();
  assert.equal(first.client.room().players.has('guest-second'), false);
  assert.equal(first.client.room().seats.size, 0);
});

test('vé đang có người dùng hoặc vào phòng lần hai thì bị báo lỗi', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const copy = guest(room);
  copy.client.join('tim-neon', 'guest-first');
  first.client.join('tim-neon', 'guest-first');
  await settle();
  assert.deepEqual(codes(copy), ['ticket_in_use']);
  assert.deepEqual(codes(first), ['already_joined']);
  assert.deepEqual([...first.client.room().players.keys()], ['guest-first']);
});

test('thông điệp hỏng hoặc không thuộc giao thức thì bị báo lỗi, phòng không sập', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const broken = [
    '{oops',
    '[]',
    JSON.stringify({ kind: 'fly' }),
    JSON.stringify({ kind: 'seat.request' }),
    JSON.stringify({ kind: 'move', sequence: 1, position: { x: 'a', y: 0, z: 0 }, yaw: 0 }),
    JSON.stringify({ kind: 'move', sequence: -1, position: { x: 0, y: 0, z: 0 }, yaw: 0 }),
    JSON.stringify({ kind: 'join', shopId: 'tim-neon' }),
    JSON.stringify({ kind: 'join', ticket: 'guest-3' }),
  ];
  for (const text of broken) first.connection.send(text);
  await settle();
  assert.deepEqual(
    codes(first),
    broken.map(() => 'bad_message'),
  );
  first.client.requestSeat('seat-1');
  await settle();
  assert.equal(first.client.room().seats.get('seat-1'), 'guest-first');
});

test('kết nối đã đóng thì gửi báo lỗi ngay và không còn nhận gì', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const second = await joined(room, 'guest-second');
  first.connection.close();
  first.connection.close();
  const before = first.heard.length;
  assert.throws(() => first.connection.send(JSON.stringify({ kind: 'seat.leave' })), /closed/);
  second.client.move(BESIDE_SECOND);
  await settle();
  assert.equal(first.heard.length, before);
});

test('nhịp của phòng tăng dần qua mọi thông điệp có nhịp', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  first.client.requestSeat('seat-1');
  await settle();
  first.client.leaveSeat();
  await settle();
  const ticks = first.heard
    .map((message) => (message as { tick?: number }).tick)
    .filter((tick): tick is number => tick !== undefined);
  assert.ok(ticks.length >= 3);
  ticks.forEach((tick, index) => {
    if (index > 0)
      assert.ok(tick > (ticks[index - 1] ?? -1), `tick ${tick} after ${ticks[index - 1]}`);
  });
});

test('mọi thông điệp phòng gửi ra đều đúng schema của giao thức nháp', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-first');
  const second = await joined(room, 'guest-second', FAR_AWAY);
  first.client.requestSeat('seat-1');
  second.client.requestSeat('seat-1');
  second.client.requestSeat('seat-2');
  second.client.requestSeat('seat-99');
  first.connection.send('{oops');
  first.client.leaveSeat();
  await settle();
  second.client.close();
  await settle();
  const sent = [...first.heard, ...second.heard];
  const kinds = new Set(sent.map((message) => (message as { kind: string }).kind));
  for (const kind of ['snapshot', 'delta', 'seat.granted', 'seat.denied', 'error']) {
    assert.ok(kinds.has(kind), `no ${kind} was sent`);
  }
  for (const message of sent) {
    assert.ok(matchesProtocol(message), JSON.stringify([message, matchesProtocol.errors]));
  }
});

test('người đang ở trong phòng thấy người mới ngay lúc họ vào, trước cả khi họ di chuyển', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-1');
  const second = guest(room);
  second.client.join('tim-neon', 'guest-2');
  await settle();
  assert.equal(first.client.room().players.has('guest-2'), true);
});

test('người mới vào nhận ảnh chụp trước tiên, không nhận tin về chính mình trước đó', async () => {
  const room = createFakeRoom(SEATS);
  await joined(room, 'guest-1');
  const second = guest(room);
  second.client.join('tim-neon', 'guest-2');
  await settle();
  assert.equal((second.heard[0] as { kind: string }).kind, 'snapshot');
  assert.equal(second.heard.length, 1);
});

test('kết nối chưa vào phòng thì không nghe được gì từ phòng', async () => {
  const room = createFakeRoom(SEATS);
  const watcher = guest(room);
  const first = await joined(room, 'guest-1');
  first.client.move(BESIDE_SECOND);
  first.client.requestSeat('seat-2');
  await settle();
  assert.deepEqual(watcher.heard, []);
});

test('người đã rời phòng thì không còn trong ảnh chụp và vé của họ dùng lại được', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-1');
  first.client.close();
  await settle();
  const again = await joined(room, 'guest-1');
  assert.deepEqual(codes(again), []);
  assert.deepEqual([...again.client.room().players.keys()], ['guest-1']);
  const second = await joined(room, 'guest-2');
  assert.deepEqual([...second.client.room().players.keys()].sort(), ['guest-1', 'guest-2']);
});

test('tin một người rời phòng mang nhịp mới, không bị coi là tin cũ', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-1');
  const second = await joined(room, 'guest-2');
  const before = first.client.room().tick;
  second.client.close();
  await settle();
  const last = first.heard.at(-1) as { kind: string; tick: number; left?: string[] };
  assert.deepEqual(last.left, ['guest-2']);
  assert.ok(last.tick > before, `tick ${last.tick} after ${before}`);
});

test('thông điệp đang trên đường tới thì bị bỏ nếu kết nối đóng trước lúc nó tới', async () => {
  const room = createFakeRoom(SEATS);
  const first = await joined(room, 'guest-1');
  const before = first.heard.length;
  first.client.requestSeat('seat-1');
  first.connection.close();
  await settle();
  assert.equal(first.heard.length, before);
});
