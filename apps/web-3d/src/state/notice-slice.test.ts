import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NOTICE_SPECS,
  VISIBLE_NOTICES,
  initialNoticeState,
  noticeActionChosen,
  noticeAdded,
  noticeDismissed,
  noticeSlice,
  noticesExpired,
  visibleNotices,
  type NoticeKind,
  type NoticeState,
} from './notice-slice.ts';

function add(state: NoticeState, kind: NoticeKind, at: number): NoticeState {
  return noticeSlice.reducer(state, noticeAdded(kind, at));
}

test('thông báo trùng không xếp thêm', () => {
  let state = add(initialNoticeState(), 'session-left', 1_000);
  state = add(state, 'session-left', 2_000);
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0]?.expiresAt, 2_000 + (NOTICE_SPECS['session-left'].lifetimeMs ?? 0));
});

test('lỗi luôn hiện trước', () => {
  let state = add(initialNoticeState(), 'session-left', 1_000);
  state = add(state, 'session-expired', 1_100);
  state = add(state, 'app-update', 1_200);
  state = add(state, 'seat-timeout', 1_300);
  const shown = visibleNotices(state).map((notice) => notice.kind);
  assert.equal(shown[0], 'seat-timeout');
  assert.equal(shown.length, VISIBLE_NOTICES);
});

test('tối đa ba thông báo cùng lúc', () => {
  let state = initialNoticeState();
  const kinds: NoticeKind[] = ['session-left', 'session-expired', 'app-update', 'seat-timeout'];
  kinds.forEach((kind, index) => {
    state = add(state, kind, 1_000 + index);
  });
  assert.equal(state.queue.length, 4);
  assert.equal(visibleNotices(state).length, 3);
  state = noticeSlice.reducer(state, noticeDismissed(visibleNotices(state)[0]!.id));
  assert.equal(visibleNotices(state).length, 3);
});

test('quá thời hạn thì tự ẩn', () => {
  let state = add(initialNoticeState(), 'session-left', 1_000);
  state = add(state, 'app-update', 1_000);
  const lifetime = NOTICE_SPECS['session-left'].lifetimeMs ?? 0;
  state = noticeSlice.reducer(state, noticesExpired(1_000 + lifetime - 1));
  assert.equal(state.queue.length, 2);
  state = noticeSlice.reducer(state, noticesExpired(1_000 + lifetime));
  assert.deepEqual(
    state.queue.map((notice) => notice.kind),
    ['app-update'],
  );
});

test('đóng tay thì thông báo biến mất, chọn hành động thì ghi lại yêu cầu', () => {
  let state = add(initialNoticeState(), 'app-update', 1_000);
  const update = state.queue[0]!;
  state = noticeSlice.reducer(state, noticeActionChosen(update.id));
  assert.equal(state.queue.length, 0);
  assert.deepEqual(state.requestedAction, { action: 'apply-update', id: update.id });
  state = add(state, 'session-left', 2_000);
  state = noticeSlice.reducer(state, noticeDismissed(state.queue[0]!.id));
  assert.equal(state.queue.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});
