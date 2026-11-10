import type { PlayerState } from '@netverse/game-shared/movement';
import { createRoomClient } from '@netverse/game-shared/room-client';
import type { RoomConnection } from '@netverse/game-shared/room-client';
import type { RoomError, RoomState, SeatDenialReason } from '@netverse/game-shared/room-protocol';

export interface SeatRefusal {
  readonly seatId: string;
  readonly reason: SeatDenialReason;
}

export interface SeatingView {
  readonly seated: string | null;
  readonly taken: readonly string[];
  readonly denied: SeatRefusal | null;
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

function viewOf(room: RoomState, ticket: string, answered: RoomError | null): SeatingView {
  const taken = [...room.seats]
    .filter(([, playerId]) => playerId !== ticket)
    .map(([seatId]) => seatId)
    .sort(seatOrder);
  const seated = room.players.get(ticket)?.seatId ?? null;
  return {
    seated,
    taken,
    denied: seated === null && room.denied ? { ...room.denied } : null,
    error: room.error && room.error !== answered ? room.error.code : null,
  };
}

export function createRoomSession(options: RoomSessionOptions): RoomSession {
  const { ticket, onChange } = options;
  const client = createRoomClient(options.connection);
  let open = true;
  let last = '';
  let answered: RoomError | null = null;
  const report = (room: RoomState) => {
    if (!open || (room.tick < 0 && !room.error)) return;
    const view = viewOf(room, ticket, answered);
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    onChange(view);
  };
  client.subscribe(report);
  client.join(options.shopId, ticket);
  return {
    requestSeat(seatId, from) {
      if (!open) return;
      answered = client.room().error;
      client.move(from);
      client.requestSeat(seatId);
      report(client.room());
    },
    leaveSeat() {
      if (!open) return;
      answered = client.room().error;
      client.leaveSeat();
      report(client.room());
    },
    close() {
      if (!open) return;
      open = false;
      client.close();
    },
  };
}
