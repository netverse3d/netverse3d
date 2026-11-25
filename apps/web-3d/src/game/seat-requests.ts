import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import {
  rentalConfirmationAccepted,
  seatLeaveRequested,
  seatRequestTimedOut,
  type SeatPending,
} from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';

export interface SeatRequester {
  requestSeat(seatId: string, from: Parameters<typeof rentalConfirmationAccepted>[0]['from']): void;
  leaveSeat(): void;
}

export const SEAT_REQUEST_TIMEOUT_MS = 8000;

type Listener = ListenerMiddlewareInstance<RootState, AppDispatch>;

function startedWaiting(original: RootState, current: RootState): SeatPending | null {
  if (original.shop.seating.pending) return null;
  return current.shop.seating.pending;
}

export function connectSeatRequests(
  listener: ListenerMiddlewareInstance,
  requester: () => SeatRequester | null,
  { timeoutMs = SEAT_REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {},
): () => void {
  const typed = listener as unknown as Listener;
  const expire = async (
    pending: SeatPending,
    api: { delay(ms: number): Promise<void>; dispatch: AppDispatch },
  ) => {
    await api.delay(timeoutMs);
    api.dispatch(seatRequestTimedOut(pending));
  };
  const stopSit = typed.startListening({
    actionCreator: rentalConfirmationAccepted,
    effect: async (action, api) => {
      const pending = startedWaiting(api.getOriginalState(), api.getState());
      if (!pending) return;
      requester()?.requestSeat(action.payload.seatId, action.payload.from);
      await expire(pending, api);
    },
  });
  const stopLeave = typed.startListening({
    actionCreator: seatLeaveRequested,
    effect: async (_action, api) => {
      const pending = startedWaiting(api.getOriginalState(), api.getState());
      if (!pending) return;
      requester()?.leaveSeat();
      await expire(pending, api);
    },
  });
  return () => {
    stopSit();
    stopLeave();
  };
}
