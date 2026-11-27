import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NoticeKind = 'seat-timeout' | 'session-expired' | 'session-left' | 'app-update';
export type NoticeTone = 'error' | 'warning' | 'info';
export type NoticeAction = 'apply-update';

export interface NoticeSpec {
  tone: NoticeTone;
  lifetimeMs: number | null;
  action?: NoticeAction;
}

export const NOTICE_SPECS: Record<NoticeKind, NoticeSpec> = {
  'seat-timeout': { tone: 'error', lifetimeMs: 6_000 },
  'session-expired': { tone: 'warning', lifetimeMs: 3_000 },
  'session-left': { tone: 'info', lifetimeMs: 3_000 },
  'app-update': { tone: 'info', lifetimeMs: null, action: 'apply-update' },
};

export const VISIBLE_NOTICES = 3;

const TONE_RANK: Record<NoticeTone, number> = { error: 0, warning: 1, info: 2 };

export interface Notice {
  id: number;
  kind: NoticeKind;
  addedAt: number;
  expiresAt: number | null;
}

export interface NoticeState {
  queue: Notice[];
  nextId: number;
  requestedAction: { action: NoticeAction; id: number } | null;
}

export function initialNoticeState(): NoticeState {
  return { queue: [], nextId: 1, requestedAction: null };
}

function expiryOf(kind: NoticeKind, at: number): number | null {
  const lifetime = NOTICE_SPECS[kind].lifetimeMs;
  return lifetime === null ? null : at + lifetime;
}

export const noticeSlice = createSlice({
  name: 'notices',
  initialState: initialNoticeState(),
  reducers: {
    noticeAdded: {
      reducer(state, action: PayloadAction<{ kind: NoticeKind; at: number }>) {
        const { kind, at } = action.payload;
        const existing = state.queue.find((notice) => notice.kind === kind);
        if (existing) {
          existing.expiresAt = expiryOf(kind, at);
          return;
        }
        state.queue.push({ id: state.nextId, kind, addedAt: at, expiresAt: expiryOf(kind, at) });
        state.nextId += 1;
      },
      prepare: (kind: NoticeKind, at: number = Date.now()) => ({ payload: { kind, at } }),
    },
    noticesWithdrawn(state, action: PayloadAction<readonly NoticeKind[]>) {
      state.queue = state.queue.filter((notice) => !action.payload.includes(notice.kind));
    },
    noticeDismissed(state, action: PayloadAction<number>) {
      state.queue = state.queue.filter((notice) => notice.id !== action.payload);
    },
    noticesExpired(state, action: PayloadAction<number>) {
      state.queue = state.queue.filter(
        (notice) => notice.expiresAt === null || notice.expiresAt > action.payload,
      );
    },
    noticeActionChosen(state, action: PayloadAction<number>) {
      const chosen = state.queue.find((notice) => notice.id === action.payload);
      const requested = chosen ? NOTICE_SPECS[chosen.kind].action : undefined;
      if (!chosen || !requested) return;
      state.queue = state.queue.filter((notice) => notice.id !== chosen.id);
      state.requestedAction = { action: requested, id: chosen.id };
    },
  },
});

export function visibleNotices(state: NoticeState): Notice[] {
  return [...state.queue]
    .sort(
      (first, second) =>
        TONE_RANK[NOTICE_SPECS[first.kind].tone] - TONE_RANK[NOTICE_SPECS[second.kind].tone] ||
        first.addedAt - second.addedAt,
    )
    .slice(0, VISIBLE_NOTICES);
}

export function nextExpiry(state: NoticeState): number | null {
  const times = state.queue.flatMap((notice) =>
    notice.expiresAt === null ? [] : [notice.expiresAt],
  );
  return times.length ? Math.min(...times) : null;
}

export const {
  noticeAdded,
  noticesWithdrawn,
  noticeDismissed,
  noticesExpired,
  noticeActionChosen,
} = noticeSlice.actions;
