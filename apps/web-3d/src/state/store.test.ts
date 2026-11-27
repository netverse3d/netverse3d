import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sessionChanged, sessionEnded, seatRequestTimedOut } from './shop-slice.ts';
import { createAppStore } from './store.ts';

test('kết thúc phiên đẩy một thông báo vào hàng đợi', () => {
  const { store } = createAppStore();
  store.dispatch(sessionChanged({ seatId: 'seat-1', endsAt: 60_000, offset: 0 }));
  store.dispatch(sessionEnded('left'));
  assert.deepEqual(
    store.getState().notices.queue.map((notice) => notice.kind),
    ['session-left'],
  );
  assert.equal(store.getState().shop.session, null);
  store.dispatch(sessionEnded('expired'));
  assert.deepEqual(
    store.getState().notices.queue.map((notice) => notice.kind),
    ['session-left', 'session-expired'],
  );
});

test('phiên mới bắt đầu thì thông báo phiên cũ không còn treo', () => {
  const { store } = createAppStore();
  store.dispatch(sessionEnded('left'));
  store.dispatch(sessionChanged({ seatId: 'seat-2', endsAt: 60_000, offset: 0 }));
  assert.deepEqual(store.getState().notices.queue, []);
});

test('phòng không phản hồi yêu cầu ngồi thì báo lỗi thay vì im lặng bỏ lệnh', () => {
  const { store } = createAppStore();
  store.dispatch(seatRequestTimedOut({ seatId: 'seat-3', action: 'sit' }));
  assert.deepEqual(
    store.getState().notices.queue.map((notice) => notice.kind),
    ['seat-timeout'],
  );
});
