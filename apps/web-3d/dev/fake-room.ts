import type { FloorBox, FloorPoint } from '@netverse/game-shared/movement';
import type { RoomConnection } from '@netverse/game-shared/room-client';
import type { ClientMessage, ServerMessage } from '@netverse/game-shared/room-protocol';
import { withinSeatReach } from '@netverse/game-shared/seating';

export interface FakeSeat {
  readonly seatId: string;
  readonly footprint: FloorBox;
}

export interface FakeRoom {
  connect(): RoomConnection;
}

interface Guest {
  readonly playerId: string;
  position: FloorPoint & { yaw: number };
  seatId: string | null;
}

interface Line {
  readonly listeners: Set<(text: string) => void>;
  guest: Guest | null;
  open: boolean;
}

type Wire = Extract<ServerMessage, { kind: 'snapshot' }>['players'][number];

const CLOSED_MESSAGE = 'Fake room connection is closed';
const DOORSTEP = { x: 0, z: 0, yaw: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function readClientMessage(text: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.kind === 'join') {
    if (!isName(parsed.shopId) || !isName(parsed.ticket)) return null;
    return { kind: 'join', shopId: parsed.shopId, ticket: parsed.ticket };
  }
  if (parsed.kind === 'move') {
    const { sequence, position, yaw } = parsed;
    if (!Number.isInteger(sequence) || (sequence as number) < 0 || !isRecord(position)) return null;
    const { x, y, z } = position;
    if (![x, y, z, yaw].every(Number.isFinite)) return null;
    return {
      kind: 'move',
      sequence: sequence as number,
      position: { x: x as number, y: y as number, z: z as number },
      yaw: yaw as number,
    };
  }
  if (parsed.kind === 'seat.request') {
    return isName(parsed.seatId) ? { kind: 'seat.request', seatId: parsed.seatId } : null;
  }
  return parsed.kind === 'seat.leave' ? { kind: 'seat.leave' } : null;
}

function wireOf(guest: Guest): Wire {
  return {
    playerId: guest.playerId,
    position: { x: guest.position.x, y: 0, z: guest.position.z },
    yaw: guest.position.yaw,
    seatId: guest.seatId,
  };
}

export function createFakeRoom(seats: readonly FakeSeat[]): FakeRoom {
  const lines = new Set<Line>();
  const footprints = new Map(seats.map((seat) => [seat.seatId, seat.footprint]));
  if (footprints.size !== seats.length) throw new TypeError('Seat ids must be unique');
  let tick = 0;

  const guests = (): Guest[] => [...lines].flatMap((line) => (line.guest ? [line.guest] : []));

  function tell(line: Line, message: ServerMessage): void {
    const text = JSON.stringify(message);
    queueMicrotask(() => {
      for (const listener of [...line.listeners]) {
        if (!line.listeners.has(listener)) continue;
        try {
          listener(text);
        } catch (failure) {
          console.error(failure);
        }
      }
    });
  }

  function tellJoined(message: ServerMessage, except?: Line): void {
    for (const line of lines) {
      if (line.guest && line !== except) tell(line, message);
    }
  }

  function shareChange(guest: Guest, except?: Line): void {
    tick += 1;
    tellJoined({ kind: 'delta', tick, changed: [wireOf(guest)] }, except);
  }

  function refuse(line: Line, code: string): void {
    tell(line, { kind: 'error', code });
  }

  function join(line: Line, ticket: string): void {
    if (line.guest) return refuse(line, 'already_joined');
    if (guests().some((guest) => guest.playerId === ticket)) return refuse(line, 'ticket_in_use');
    const guest: Guest = { playerId: ticket, position: DOORSTEP, seatId: null };
    line.guest = guest;
    if (guests().length > 1) shareChange(guest, line);
    tell(line, { kind: 'snapshot', tick, players: guests().map(wireOf) });
  }

  function settleSeat(line: Line, guest: Guest, seatId: string): void {
    const footprint = footprints.get(seatId);
    if (!footprint) return refuse(line, 'unknown_seat');
    if (guest.seatId !== null) return refuse(line, 'already_seated');
    if (guests().some((other) => other.seatId === seatId)) {
      return tell(line, { kind: 'seat.denied', seatId, reason: 'occupied' });
    }
    if (!withinSeatReach(guest.position, footprint)) {
      return tell(line, { kind: 'seat.denied', seatId, reason: 'too_far' });
    }
    guest.seatId = seatId;
    tellJoined({ kind: 'seat.granted', seatId, playerId: guest.playerId });
    shareChange(guest);
  }

  function receive(line: Line, text: string): void {
    const message = readClientMessage(text);
    if (!message) return refuse(line, 'bad_message');
    if (message.kind === 'join') return join(line, message.ticket);
    const guest = line.guest;
    if (!guest) return refuse(line, 'not_joined');
    if (message.kind === 'move') {
      if (guest.seatId !== null) return;
      guest.position = { x: message.position.x, z: message.position.z, yaw: message.yaw };
      return shareChange(guest);
    }
    if (message.kind === 'seat.request') return settleSeat(line, guest, message.seatId);
    if (guest.seatId === null) return;
    guest.seatId = null;
    shareChange(guest);
  }

  function leave(line: Line): void {
    if (!line.open) return;
    line.open = false;
    lines.delete(line);
    line.listeners.clear();
    if (!line.guest) return;
    tick += 1;
    tellJoined({ kind: 'delta', tick, left: [line.guest.playerId] });
  }

  return {
    connect() {
      const line: Line = { listeners: new Set(), guest: null, open: true };
      lines.add(line);
      return {
        send(text) {
          if (!line.open) throw new Error(CLOSED_MESSAGE);
          receive(line, text);
        },
        listen(onText) {
          if (!line.open) throw new Error(CLOSED_MESSAGE);
          line.listeners.add(onText);
          return () => {
            line.listeners.delete(onText);
          };
        },
        close() {
          leave(line);
        },
      };
    },
  };
}
