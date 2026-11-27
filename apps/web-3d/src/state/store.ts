import {
  configureStore,
  createListenerMiddleware,
  type ListenerMiddlewareInstance,
} from '@reduxjs/toolkit';
import { noticeAdded, noticeSlice, noticesWithdrawn, type NoticeKind } from './notice-slice.ts';
import { seatRequestTimedOut, sessionChanged, sessionEnded, shopSlice } from './shop-slice.ts';

const SESSION_NOTICES: readonly NoticeKind[] = ['session-expired', 'session-left'];

function connectNotices(listener: ListenerMiddlewareInstance) {
  listener.startListening({
    actionCreator: sessionEnded,
    effect: (action, api) => {
      api.dispatch(noticeAdded(action.payload === 'expired' ? 'session-expired' : 'session-left'));
    },
  });
  listener.startListening({
    actionCreator: sessionChanged,
    effect: (action, api) => {
      if (action.payload) api.dispatch(noticesWithdrawn(SESSION_NOTICES));
    },
  });
  listener.startListening({
    actionCreator: seatRequestTimedOut,
    effect: (_action, api) => {
      api.dispatch(noticeAdded('seat-timeout'));
    },
  });
}

export function createAppStore() {
  const listener = createListenerMiddleware();
  const store = configureStore({
    reducer: { shop: shopSlice.reducer, notices: noticeSlice.reducer },
    middleware: (defaults) => defaults().prepend(listener.middleware),
  });
  connectNotices(listener);
  return { store, listener };
}

export type AppStore = ReturnType<typeof createAppStore>['store'];
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
