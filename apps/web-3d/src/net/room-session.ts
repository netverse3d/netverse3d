import type { PlayerState } from '@netverse/game-shared/movement';
import { createRoomClient } from '@netverse/game-shared/room-client';
import type { RoomConnection } from '@netverse/game-shared/room-client';
import type {
  RoomError,
  RoomState,
  SeatDenialReason,
  SeatEndReason,
} from '@netverse/game-shared/room-protocol';
import type { SeatSession } from '../state/shop-slice.ts';

export interface SeatRefusal {
  readonly seatId: string;
  readonly reason: SeatDenialReason;
}

export interface SeatingView {
  readonly seated: string | null;
  readonly taken: readonly string[];
  readonly denied: SeatRefusal | null;
  readonly error: string | null;
  readonly session: SeatSession | null;
  readonly ended: { readonly seatId: string; readonly reason: SeatEndReason } | null;
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
  readonly now?: () => number;
  readonly onChange: (view: SeatingView) => void;
}

function seatOrder(first: string, second: string): number {
  return first.localeCompare(second, 'en', { numeric: true });
}

function viewOf(
  room: RoomState,
  ticket: string,
  answered: RoomError | null,
  session: SeatSession | null,
  ended: SeatingView['ended'],
): SeatingView {
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
    session: seated === session?.seatId ? session : null,
    ended,
  };
}

export function createRoomSession(options: RoomSessionOptions): RoomSession {
  const { ticket, onChange } = options;
  const client = createRoomClient(options.connection);
  let open = true;
  let last = '';
  let answered: RoomError | null = null;
  let activeSeatId: string | null = null;
  let activeSession: SeatSession | null = null;
  const now = options.now ?? Date.now;
  const report = (room: RoomState) => {
    if (!open || (room.tick < 0 && !room.error)) return;
    const seated = room.players.get(ticket)?.seatId ?? null;
    if (seated !== null) activeSeatId = seated;
    if (room.grant?.playerId === ticket) {
      activeSeatId = room.grant.seatId;
      activeSession =
        room.grant.endsAt === undefined
          ? null
          : {
              seatId: room.grant.seatId,
              endsAt: room.grant.endsAt,
              offset: room.grant.serverTime === undefined ? 0 : room.grant.serverTime - now(),
            };
    }
    const ended = room.ended && room.ended.seatId === activeSeatId ? { ...room.ended } : null;
    if (ended) {
      activeSeatId = null;
      activeSession = null;
    }
    const view = viewOf(room, ticket, answered, activeSession, ended);
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
