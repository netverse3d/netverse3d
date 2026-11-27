import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { noticeSlice } from './notice-slice.ts';
import { shopSlice } from './shop-slice.ts';

export function createAppStore() {
  const listener = createListenerMiddleware();
  const store = configureStore({
    reducer: { shop: shopSlice.reducer, notices: noticeSlice.reducer },
    middleware: (defaults) => defaults().prepend(listener.middleware),
  });
  return { store, listener };
}

export type AppStore = ReturnType<typeof createAppStore>['store'];
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
