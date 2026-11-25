import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectSeatRequests } from '../../../src/game/seat-requests.ts';
import {
  NO_ROOM,
  rentalConfirmationAccepted,
  rentalConfirmationRequested,
  seatLeaveRequested,
  seatingChanged,
} from '../../../src/state/shop-slice.ts';
import { createAppStore } from '../../../src/state/store.ts';

const FROM = { x: 0, z: 0, heading: 0 } as never;
const ROOM = { ...NO_ROOM, available: true };

function setup(timeoutMs = 1000) {
  const { store, listener } = createAppStore();
  const calls: string[] = [];
  connectSeatRequests(
    listener,
    () => ({
      requestSeat: (seatId: string) => void calls.push(`sit:${seatId}`),
      leaveSeat: () => void calls.push('leave'),
    }),
    { timeoutMs },
  );
  store.dispatch(seatingChanged(ROOM));
  return { store, calls };
}

function pressAndConfirm(store: ReturnType<typeof setup>['store'], seatId: string) {
  store.dispatch(rentalConfirmationRequested({ seatId, from: FROM }));
  const request = store.getState().shop.rentalConfirmation;
  if (request) store.dispatch(rentalConfirmationAccepted(request));
}

test('nhấn E hai lần khi đang chờ chỉ gửi một yêu cầu ngồi', () => {
  const { store, calls } = setup();
  pressAndConfirm(store, 'seat-1');
  pressAndConfirm(store, 'seat-1');
  assert.deepEqual(calls, ['sit:seat-1']);
  assert.equal(store.getState().shop.rentalConfirmation, null);
  assert.deepEqual(store.getState().shop.seating.pending, { seatId: 'seat-1', action: 'sit' });
});

test('chỉ phòng mới đặt được trạng thái đã ngồi', () => {
  const { store } = setup();
  pressAndConfirm(store, 'seat-1');
  assert.equal(store.getState().shop.seating.seated, null);
  store.dispatch(seatingChanged({ ...ROOM, taken: ['seat-2'] }));
  assert.notEqual(store.getState().shop.seating.pending, null);
  store.dispatch(seatingChanged({ ...ROOM, seated: 'seat-1', taken: ['seat-1'] }));
  assert.equal(store.getState().shop.seating.seated, 'seat-1');
  assert.equal(store.getState().shop.seating.pending, null);
});

test('bị từ chối thì thôi chờ và được thử lại', () => {
  const { store, calls } = setup();
  pressAndConfirm(store, 'seat-1');
  store.dispatch(seatingChanged({ ...ROOM, denied: { seatId: 'seat-1', reason: 'occupied' } }));
  assert.equal(store.getState().shop.seating.pending, null);
  pressAndConfirm(store, 'seat-1');
  assert.deepEqual(calls, ['sit:seat-1', 'sit:seat-1']);
});

test('đứng dậy khi đang chờ chỉ gửi một lần', () => {
  const { store, calls } = setup();
  store.dispatch(seatingChanged({ ...ROOM, seated: 'seat-1', taken: ['seat-1'] }));
  store.dispatch(seatLeaveRequested());
  store.dispatch(seatLeaveRequested());
  assert.deepEqual(calls, ['leave']);
  store.dispatch(seatingChanged(ROOM));
  assert.equal(store.getState().shop.seating.pending, null);
});

test('phòng không trả lời quá thời hạn thì thôi chờ', async () => {
  const { store } = setup(20);
  pressAndConfirm(store, 'seat-1');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(store.getState().shop.seating.pending, null);
});
