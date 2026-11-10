import type { PlayerState } from '@netverse/game-shared/movement';
import { createRoomClient } from '@netverse/game-shared/room-client';
import type { RoomConnection } from '@netverse/game-shared/room-client';
import type { RoomState, SeatDenialReason } from '@netverse/game-shared/room-protocol';

export interface SeatingView {
  readonly seated: string | null;
  readonly taken: readonly string[];
  readonly denied: SeatDenialReason | null;
  readonly error: string | null;
}

export interface RoomSession {
  requestSeat(seatId: string, from: PlayerState): void;
  leaveSeat(): void;
  close(): void;
}

export interface RoomSessionOptions {
  readonly connection: RoomConnection;
  readonly shopId: string;
  readonly ticket: string;
  readonly onChange: (view: SeatingView) => void;
}

function seatOrder(first: string, second: string): number {
  return first.localeCompare(second, 'en', { numeric: true });
}

function viewOf(room: RoomState, ticket: string): SeatingView {
  const taken = [...room.seats]
    .filter(([, playerId]) => playerId !== ticket)
    .map(([seatId]) => seatId)
    .sort(seatOrder);
  return {
    seated: room.players.get(ticket)?.seatId ?? null,
    taken,
    denied: room.denied?.reason ?? null,
    error: room.error?.code ?? null,
  };
}

export function createRoomSession(options: RoomSessionOptions): RoomSession {
  const { ticket, onChange } = options;
  const client = createRoomClient(options.connection);
  let open = true;
  let last = '';
  client.subscribe((room) => {
    if (!open || room.tick < 0) return;
    const view = viewOf(room, ticket);
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    onChange(view);
  });
  client.join(options.shopId, ticket);
  return {
    requestSeat(seatId, from) {
      if (!open) return;
      client.move(from);
      client.requestSeat(seatId);
    },
    leaveSeat() {
      if (open) client.leaveSeat();
    },
    close() {
      if (!open) return;
      open = false;
      client.close();
    },
  };
}
