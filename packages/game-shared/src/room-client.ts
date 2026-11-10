import type { PlayerState } from './movement.ts';
import {
  applyServerMessage,
  emptyRoom,
  joinMessage,
  moveMessage,
  readServerMessage,
  seatLeaveMessage,
  seatRequestMessage,
  withoutDenial,
  type ClientMessage,
  type RoomState,
} from './room-protocol.ts';

export interface RoomConnection {
  send(text: string): void;
  listen(onText: (text: string) => void): () => void;
  close(): void;
}

export type RoomListener = (room: RoomState) => void;

export interface RoomClient {
  room(): RoomState;
  rejected(): number;
  join(shopId: string, ticket: string): void;
  move(player: PlayerState): void;
  requestSeat(seatId: string): void;
  leaveSeat(): void;
  subscribe(listener: RoomListener): () => void;
  close(): void;
}

interface Subscription {
  readonly listener: RoomListener;
}

const CLOSED_MESSAGE = 'Room client is closed';

export function createRoomClient(connection: RoomConnection): RoomClient {
  const subscriptions = new Set<Subscription>();
  let room = emptyRoom();
  let rejected = 0;
  let sequence = 0;
  let closed = false;

  function show(next: RoomState): void {
    if (next === room) return;
    room = next;
    const failures: unknown[] = [];
    for (const subscription of [...subscriptions]) {
      if (!subscriptions.has(subscription)) continue;
      try {
        subscription.listener(room);
      } catch (failure) {
        failures.push(failure);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Room listeners failed');
  }

  function send(message: ClientMessage): void {
    if (closed) throw new Error(CLOSED_MESSAGE);
    connection.send(JSON.stringify(message));
  }

  const stopListening = connection.listen((text) => {
    if (closed) return;
    const message = readServerMessage(text);
    if (!message) {
      rejected += 1;
      return;
    }
    show(applyServerMessage(room, message));
  });

  return {
    room: () => room,
    rejected: () => rejected,
    join: (shopId, ticket) => send(joinMessage(shopId, ticket)),
    leaveSeat: () => send(seatLeaveMessage()),
    move(player) {
      send(moveMessage(sequence, player));
      sequence += 1;
    },
    requestSeat(seatId) {
      send(seatRequestMessage(seatId));
      show(withoutDenial(room));
    },
    subscribe(listener) {
      if (closed) throw new Error(CLOSED_MESSAGE);
      const subscription = { listener };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      subscriptions.clear();
      stopListening();
      connection.close();
    },
  };
}
