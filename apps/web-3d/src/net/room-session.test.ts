import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { RoomConnection } from '@netverse/game-shared/room-client';

import { createRoomSession } from './room-session.ts';
import type { SeatingView } from './room-session.ts';

interface Wire {
  connection: RoomConnection;
  sent: Record<string, unknown>[];
  closes: () => number;
  deliver(message: unknown): void;
}

const ME = 'guest-1';
const OTHER = 'guest-2';
const EMPTY: SeatingView = { seated: null, taken: [], denied: null, error: null };

function wire(): Wire {
  const listeners = new Set<(text: string) => void>();
  const sent: Record<string, unknown>[] = [];
  let closed = 0;
  return {
    sent,
    closes: () => closed,
    deliver: (message) => listeners.forEach((listener) => listener(JSON.stringify(message))),
    connection: {
      send: (text) => {
        sent.push(JSON.parse(text));
      },
      listen: (onText) => {
        listeners.add(onText);
        return () => {
          listeners.delete(onText);
        };
      },
      close: () => {
        closed += 1;
      },
    },
  };
}

function player(playerId: string, seatId: string | null = null) {
  return { playerId, position: { x: 0, y: 0, z: 0 }, yaw: 0, seatId };
}

function open(line: Wire) {
  const views: SeatingView[] = [];
  const session = createRoomSession({
    connection: line.connection,
    shopId: 'tim-neon',
    ticket: ME,
    onChange: (view) => views.push(view),
  });
  return { session, views };
}

test('mở phiên là vào phòng ngay bằng tên tiệm và vé của mình', () => {
  const line = wire();
  open(line);
  assert.deepEqual(line.sent, [{ kind: 'join', shopId: 'tim-neon', ticket: ME }]);
});

test('vào phòng xong thì báo chưa ngồi máy nào và không máy nào bận', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  assert.deepEqual(views, [EMPTY]);
});

test('xin máy thì báo vị trí đang đứng trước rồi mới gửi yêu cầu', () => {
  const line = wire();
  const { session } = open(line);
  session.requestSeat('seat-2', { x: 1.5, z: -2, yaw: 0.4 });
  assert.deepEqual(line.sent.slice(1), [
    { kind: 'move', sequence: 0, position: { x: 1.5, y: 0, z: -2 }, yaw: 0.4 },
    { kind: 'seat.request', seatId: 'seat-2' },
  ]);
});

test('được cấp máy thì báo mình đang ngồi máy đó, máy của mình không tính là bận', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  line.deliver({ kind: 'seat.granted', seatId: 'seat-2', playerId: ME });
  assert.deepEqual(views.at(-1), { ...EMPTY, seated: 'seat-2' });
});

test('máy người khác đang ngồi được báo là bận, theo thứ tự tên máy', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({
    kind: 'snapshot',
    tick: 0,
    players: [player(ME), player(OTHER, 'seat-3'), player('guest-3', 'seat-1')],
  });
  assert.deepEqual(views.at(-1), { ...EMPTY, taken: ['seat-1', 'seat-3'] });
});

test('bị từ chối thì báo lý do và vẫn chưa ngồi; xin lại thì lý do cũ được gỡ', () => {
  const line = wire();
  const { session, views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  line.deliver({ kind: 'seat.denied', seatId: 'seat-2', reason: 'occupied' });
  assert.deepEqual(views.at(-1), {
    ...EMPTY,
    denied: { seatId: 'seat-2', reason: 'occupied' },
  });
  session.requestSeat('seat-2', { x: 0, z: 0, yaw: 0 });
  assert.deepEqual(views.at(-1), EMPTY);
});

test('rời máy gửi yêu cầu rời, và phòng báo lại thì mình hết ngồi', () => {
  const line = wire();
  const { session, views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME, 'seat-2')] });
  session.leaveSeat();
  assert.deepEqual(line.sent.at(-1), { kind: 'seat.leave' });
  line.deliver({ kind: 'delta', tick: 1, changed: [player(ME)] });
  assert.deepEqual(views.at(-1), EMPTY);
});

test('lỗi từ phòng được báo bằng mã lỗi', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  line.deliver({ kind: 'error', code: 'unknown_seat' });
  assert.deepEqual(views.at(-1), { ...EMPTY, error: 'unknown_seat' });
});

test('tin không làm đổi chuyện ngồi máy thì không báo lại', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME), player(OTHER)] });
  const before = views.length;
  line.deliver({
    kind: 'delta',
    tick: 1,
    changed: [{ ...player(OTHER), position: { x: 4, y: 0, z: 1 } }],
  });
  line.deliver({ kind: 'delta', tick: 2, changed: [player(ME)] });
  assert.equal(views.length, before);
});

test('đóng phiên thì đóng kết nối, không báo gì thêm, và xin máy sau đó không gửi gì', () => {
  const line = wire();
  const { session, views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  session.close();
  session.close();
  assert.equal(line.closes(), 1);
  const before = views.length;
  const sentBefore = line.sent.length;
  line.deliver({ kind: 'seat.granted', seatId: 'seat-2', playerId: ME });
  session.requestSeat('seat-2', { x: 0, z: 0, yaw: 0 });
  session.leaveSeat();
  assert.equal(views.length, before);
  assert.equal(line.sent.length, sentBefore);
});

test('chưa nhận ảnh chụp của phòng thì chưa báo gì về chuyện ngồi máy', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'seat.granted', seatId: 'seat-2', playerId: OTHER });
  line.deliver({ kind: 'seat.denied', seatId: 'seat-2', reason: 'too_far' });
  assert.deepEqual(views, []);
});

test('phòng từ chối cho vào thì lỗi được báo ngay dù chưa có ảnh chụp', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'error', code: 'ticket_in_use' });
  assert.deepEqual(views, [{ ...EMPTY, error: 'ticket_in_use' }]);
});

test('lỗi cũ được gỡ lúc người chơi thử lại, không treo mãi', () => {
  const line = wire();
  const { session, views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME, 'seat-2')] });
  line.deliver({ kind: 'error', code: 'already_seated' });
  assert.equal(views.at(-1)?.error, 'already_seated');
  session.leaveSeat();
  assert.equal(views.at(-1)?.error, null);
  line.deliver({ kind: 'error', code: 'unknown_seat' });
  assert.equal(views.at(-1)?.error, 'unknown_seat');
  session.requestSeat('seat-1', { x: 0, z: 0, yaw: 0 });
  assert.equal(views.at(-1)?.error, null);
});

test('đã được cấp máy thì lý do bị từ chối trước đó không còn được báo', () => {
  const line = wire();
  const { views } = open(line);
  line.deliver({ kind: 'snapshot', tick: 0, players: [player(ME)] });
  line.deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'occupied' });
  line.deliver({ kind: 'seat.granted', seatId: 'seat-2', playerId: ME });
  assert.deepEqual(views.at(-1), { ...EMPTY, seated: 'seat-2' });
});
