import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoomClient, type RoomConnection } from './room-client.ts';

interface FakeConnection {
  readonly sent: { kind: string; sequence?: number; position?: object }[];
  readonly connection: RoomConnection;
  readonly closes: () => number;
  readonly listenerCount: () => number;
  readonly deliver: (message: object | string) => void;
  failSending: boolean;
}

function fakeConnection({ deafStop = false, brokenStop = false } = {}): FakeConnection {
  const listeners = new Set<(text: string) => void>();
  let closes = 0;
  const fake: FakeConnection = {
    sent: [],
    failSending: false,
    closes: () => closes,
    listenerCount: () => listeners.size,
    deliver: (message) => {
      const text = typeof message === 'string' ? message : JSON.stringify(message);
      for (const listener of [...listeners]) listener(text);
    },
    connection: {
      send: (text) => {
        if (fake.failSending) throw new Error('socket is not open');
        fake.sent.push(JSON.parse(text));
      },
      listen: (listener) => {
        listeners.add(listener);
        return () => {
          if (brokenStop) throw new Error('stop boom');
          if (!deafStop) listeners.delete(listener);
        };
      },
      close: () => {
        closes += 1;
      },
    },
  };
  return fake;
}

const AN = { playerId: 'an', position: { x: 1, y: 0, z: 2 }, yaw: 0.5, seatId: null };

function snapshot(tick: number, players: object[] = [AN]): object {
  return { kind: 'snapshot', tick, players };
}

test('vào phòng, xin máy và rời máy gửi đúng thông điệp qua kết nối', () => {
  const { sent, connection } = fakeConnection();
  const client = createRoomClient(connection);
  client.join('tim-neon', 'guest-ticket');
  client.requestSeat('seat-1');
  client.leaveSeat();
  assert.deepEqual(sent, [
    { kind: 'join', shopId: 'tim-neon', ticket: 'guest-ticket' },
    { kind: 'seat.request', seatId: 'seat-1' },
    { kind: 'seat.leave' },
  ]);
});

test('mỗi lần báo di chuyển mang số thứ tự tăng dần từ không', () => {
  const { sent, connection } = fakeConnection();
  const client = createRoomClient(connection);
  client.move({ x: 0, z: 0, yaw: 0 });
  client.move({ x: 1, z: 0, yaw: 0 });
  client.move({ x: 2, z: 0, yaw: 0 });
  assert.deepEqual(
    sent.map((message) => message.sequence),
    [0, 1, 2],
  );
  assert.deepEqual(sent[1]?.position, { x: 1, y: 0, z: 0 });
});

test('lần gửi hỏng không tiêu mất số thứ tự và lỗi tới tay người gọi', () => {
  const fake = fakeConnection();
  const client = createRoomClient(fake.connection);
  client.move({ x: 0, z: 0, yaw: 0 });
  fake.failSending = true;
  assert.throws(() => client.move({ x: 1, z: 0, yaw: 0 }), /socket is not open/);
  fake.failSending = false;
  assert.throws(() => client.move({ x: NaN, z: 0, yaw: 0 }), /player\.x/);
  client.move({ x: 2, z: 0, yaw: 0 });
  assert.deepEqual(
    fake.sent.map((message) => message.sequence),
    [0, 1],
  );
});

test('thông điệp từ server cập nhật trạng thái phòng và báo cho người nghe', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: number[] = [];
  client.subscribe((room) => seen.push(room.seats.size));
  deliver(snapshot(1));
  deliver({ kind: 'seat.granted', seatId: 'seat-1', playerId: 'an' });
  assert.equal(client.room().players.get('an')?.yaw, 0.5);
  assert.equal(client.room().seats.get('seat-1'), 'an');
  assert.deepEqual(seen, [0, 1]);
});

test('thông điệp không làm đổi phòng thì không báo người nghe', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let calls = 0;
  client.subscribe(() => {
    calls += 1;
  });
  deliver(snapshot(5));
  deliver({ kind: 'delta', tick: 4, left: ['an'] });
  deliver({ kind: 'seat.granted', seatId: 'seat-1', playerId: 'nobody' });
  assert.equal(calls, 1);
});

test('thông điệp hỏng không làm đổi trạng thái nhưng được đếm lại', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let calls = 0;
  client.subscribe(() => {
    calls += 1;
  });
  deliver(snapshot(1));
  const before = client.room();
  deliver('not json');
  deliver({ kind: 'teleport' });
  assert.equal(client.room(), before);
  assert.equal(client.rejected(), 2);
  assert.equal(calls, 1);
});

test('xin máy lần nữa thì gỡ lý do bị từ chối lần trước', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: (string | null)[] = [];
  deliver(snapshot(1));
  deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' });
  client.subscribe((room) => seen.push(room.denied?.reason ?? null));
  client.requestSeat('seat-1');
  assert.equal(client.room().denied, null);
  assert.deepEqual(seen, [null]);
});

test('xin máy mà gửi hỏng thì lý do bị từ chối cũ còn nguyên', () => {
  const fake = fakeConnection();
  const client = createRoomClient(fake.connection);
  fake.deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' });
  fake.failSending = true;
  assert.throws(() => client.requestSeat('seat-1'), /socket is not open/);
  assert.equal(client.room().denied?.reason, 'too_far');
});

test('một người nghe ném lỗi thì những người nghe khác vẫn được báo rồi lỗi mới nổi lên', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: number[] = [];
  client.subscribe(() => {
    throw new Error('listener boom');
  });
  client.subscribe((room) => seen.push(room.tick));
  assert.throws(
    () => deliver(snapshot(1)),
    (failure: unknown) =>
      failure instanceof AggregateError &&
      failure.errors.length === 1 &&
      failure.errors[0].message === 'listener boom',
  );
  assert.equal(client.room().tick, 1);
  assert.deepEqual(seen, [1]);
});

test('nhiều người nghe cùng ném lỗi thì các lỗi được gom lại', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  client.subscribe(() => {
    throw new Error('first');
  });
  client.subscribe(() => {
    throw new Error('second');
  });
  assert.throws(
    () => deliver(snapshot(1)),
    (failure: unknown) => failure instanceof AggregateError && failure.errors.length === 2,
  );
});

test('người nghe đã huỷ đăng ký thì không còn được báo, kể cả khi bị huỷ giữa lượt báo', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: string[] = [];
  const stops: (() => void)[] = [];
  client.subscribe(() => {
    seen.push('first');
    stops[0]?.();
  });
  stops.push(client.subscribe(() => seen.push('second')));
  deliver(snapshot(1));
  deliver(snapshot(2));
  assert.deepEqual(seen, ['first', 'first']);
});

test('người nghe đăng ký giữa lượt báo chỉ được báo từ lượt sau', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: number[] = [];
  let joined = false;
  client.subscribe(() => {
    if (joined) return;
    joined = true;
    client.subscribe((room) => seen.push(room.tick));
  });
  deliver(snapshot(1));
  deliver(snapshot(2));
  assert.deepEqual(seen, [2]);
});

test('cùng một hàm đăng ký hai lần thì huỷ một lần chỉ bỏ một lượt nghe', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let calls = 0;
  const listener = (): void => {
    calls += 1;
  };
  const stopFirst = client.subscribe(listener);
  client.subscribe(listener);
  stopFirst();
  deliver(snapshot(1));
  assert.equal(calls, 1);
});

test('đóng thì thôi nghe, đóng kết nối đúng một lần và từ chối mọi lời gọi sau đó', () => {
  const { sent, deliver, listenerCount, closes, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let calls = 0;
  client.subscribe(() => {
    calls += 1;
  });
  deliver(snapshot(1));
  client.close();
  client.close();
  assert.equal(listenerCount(), 0);
  assert.equal(closes(), 1);
  assert.throws(() => client.move({ x: 0, z: 0, yaw: 0 }), /closed/);
  assert.throws(() => client.subscribe(() => {}), /closed/);
  assert.equal(sent.length, 0);
  assert.equal(calls, 1);
});

test('thông điệp vẫn tới sau khi đóng thì bị bỏ, không đổi phòng và không bị đếm là hỏng', () => {
  const { deliver, connection } = fakeConnection({ deafStop: true });
  const client = createRoomClient(connection);
  deliver(snapshot(1));
  client.close();
  deliver(snapshot(2, []));
  deliver('not json');
  assert.equal(client.room().tick, 1);
  assert.equal(client.rejected(), 0);
});

test('đóng ngay trong lúc được báo thì những người nghe phía sau không bị gọi nữa', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let late = 0;
  client.subscribe(() => client.close());
  client.subscribe(() => {
    late += 1;
  });
  deliver(snapshot(1));
  assert.equal(late, 0);
});

test('thay đổi phát sinh giữa lượt báo được xếp hàng: mọi người nghe thấy đủ từng trạng thái, đúng thứ tự, một lần', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: string[] = [];
  deliver(snapshot(1));
  client.subscribe((room) => {
    seen.push(`first:${room.denied?.reason ?? 'none'}`);
    if (room.denied) client.requestSeat('seat-2');
  });
  client.subscribe((room) => seen.push(`second:${room.denied?.reason ?? 'none'}`));
  deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' });
  assert.deepEqual(seen, ['first:too_far', 'second:too_far', 'first:none', 'second:none']);
});

test('người nghe ném lỗi ở lượt báo xếp hàng thì mỗi lỗi chỉ được gom một lần', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  deliver(snapshot(1));
  client.subscribe((room) => {
    if (room.denied) client.requestSeat('seat-2');
  });
  client.subscribe((room) => {
    if (!room.denied) throw new Error('late boom');
  });
  assert.throws(
    () => deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' }),
    (failure: unknown) => failure instanceof AggregateError && failure.errors.length === 1,
  );
});

test('lỗi của người nghe luôn được bọc lại để phân biệt với lỗi gửi', () => {
  const fake = fakeConnection();
  const client = createRoomClient(fake.connection);
  fake.deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' });
  client.subscribe(() => {
    throw new Error('listener boom');
  });
  assert.throws(() => client.requestSeat('seat-1'), /Room listeners failed/);
  assert.equal(fake.sent.length, 1);
  assert.equal(client.room().denied, null);
});

test('xin máy lúc không có lý do từ chối nào và rời máy đều không báo người nghe', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  let calls = 0;
  deliver(snapshot(1));
  deliver({ kind: 'seat.denied', seatId: 'seat-1', reason: 'too_far' });
  client.subscribe(() => {
    calls += 1;
  });
  client.leaveSeat();
  assert.equal(client.room().denied?.reason, 'too_far');
  client.requestSeat('seat-1');
  client.requestSeat('seat-1');
  assert.equal(calls, 1);
});

test('hàm huỷ nghe của kết nối ném lỗi thì kết nối vẫn được đóng', () => {
  const { closes, connection } = fakeConnection({ brokenStop: true });
  const client = createRoomClient(connection);
  assert.throws(() => client.close(), /stop boom/);
  assert.equal(closes(), 1);
  client.close();
  assert.equal(closes(), 1);
});

test('nhiều thay đổi dồn lại trong một lượt báo được báo lần lượt, không bỏ trạng thái giữa chừng', () => {
  const { deliver, connection } = fakeConnection();
  const client = createRoomClient(connection);
  const seen: number[] = [];
  client.subscribe((room) => {
    if (room.tick !== 1) return;
    deliver(snapshot(2));
    deliver(snapshot(3));
  });
  client.subscribe((room) => seen.push(room.tick));
  deliver(snapshot(1));
  assert.deepEqual(seen, [1, 2, 3]);
});
