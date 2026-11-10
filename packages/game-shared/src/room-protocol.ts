import type { PlayerState } from './movement.ts';

export type SeatDenialReason = 'occupied' | 'too_far' | 'no_balance';

interface WirePosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface WirePlayer {
  readonly playerId: string;
  readonly position: WirePosition;
  readonly yaw: number;
  readonly seatId?: string | null;
}

export type ClientMessage =
  | { readonly kind: 'join'; readonly shopId: string; readonly ticket: string }
  | {
      readonly kind: 'move';
      readonly sequence: number;
      readonly position: WirePosition;
      readonly yaw: number;
    }
  | { readonly kind: 'seat.request'; readonly seatId: string }
  | { readonly kind: 'seat.leave' };

export type ServerMessage =
  | { readonly kind: 'snapshot'; readonly tick: number; readonly players: readonly WirePlayer[] }
  | {
      readonly kind: 'delta';
      readonly tick: number;
      readonly changed?: readonly WirePlayer[];
      readonly left?: readonly string[];
    }
  | { readonly kind: 'seat.granted'; readonly seatId: string; readonly playerId: string }
  | { readonly kind: 'seat.denied'; readonly seatId: string; readonly reason: SeatDenialReason }
  | { readonly kind: 'error'; readonly code: string; readonly message?: string };

export interface RoomPlayer extends PlayerState {
  readonly playerId: string;
  readonly seatId: string | null;
}

export interface SeatDenial {
  readonly seatId: string;
  readonly reason: SeatDenialReason;
}

export interface RoomError {
  readonly code: string;
  readonly message?: string;
}

export interface RoomState {
  readonly tick: number;
  readonly players: ReadonlyMap<string, RoomPlayer>;
  readonly seats: ReadonlyMap<string, string>;
  readonly denied: SeatDenial | null;
  readonly error: RoomError | null;
}

type UnknownRecord = Record<string, unknown>;

const FLOOR_HEIGHT = 0;
const DENIAL_REASONS: ReadonlySet<unknown> = new Set(['occupied', 'too_far', 'no_balance']);

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function requireName(value: string, label: string): string {
  if (!isText(value) || value === '') throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function requireFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}

export function joinMessage(shopId: string, ticket: string): ClientMessage {
  return {
    kind: 'join',
    shopId: requireName(shopId, 'shopId'),
    ticket: requireName(ticket, 'ticket'),
  };
}

export function moveMessage(sequence: number, player: PlayerState): ClientMessage {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new TypeError('sequence must be a non-negative integer');
  }
  return {
    kind: 'move',
    sequence,
    position: {
      x: requireFinite(player.x, 'player.x'),
      y: FLOOR_HEIGHT,
      z: requireFinite(player.z, 'player.z'),
    },
    yaw: requireFinite(player.yaw, 'player.yaw'),
  };
}

export function seatRequestMessage(seatId: string): ClientMessage {
  return { kind: 'seat.request', seatId: requireName(seatId, 'seatId') };
}

export function seatLeaveMessage(): ClientMessage {
  return { kind: 'seat.leave' };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTick(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPosition(value: unknown): boolean {
  return isRecord(value) && [value.x, value.y, value.z].every(Number.isFinite);
}

function isPlayer(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value.playerId) &&
    isPosition(value.position) &&
    Number.isFinite(value.yaw) &&
    (value.seatId === undefined || value.seatId === null || isText(value.seatId))
  );
}

function isOptionalList(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isItem));
}

const SERVER_SHAPES: ReadonlyMap<unknown, (message: UnknownRecord) => boolean> = new Map([
  [
    'snapshot',
    (message: UnknownRecord) =>
      isTick(message.tick) && Array.isArray(message.players) && message.players.every(isPlayer),
  ],
  [
    'delta',
    (message: UnknownRecord) =>
      isTick(message.tick) &&
      isOptionalList(message.changed, isPlayer) &&
      isOptionalList(message.left, isText),
  ],
  ['seat.granted', (message: UnknownRecord) => isText(message.seatId) && isText(message.playerId)],
  [
    'seat.denied',
    (message: UnknownRecord) => isText(message.seatId) && DENIAL_REASONS.has(message.reason),
  ],
  [
    'error',
    (message: UnknownRecord) =>
      isText(message.code) && (message.message === undefined || isText(message.message)),
  ],
]);

export function readServerMessage(text: string): ServerMessage | null {
  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(message)) return null;
  const hasShape = SERVER_SHAPES.get(message.kind);
  return hasShape?.(message) ? (message as unknown as ServerMessage) : null;
}

export function emptyRoom(): RoomState {
  return { tick: -1, players: new Map(), seats: new Map(), denied: null, error: null };
}

function vacateSeat(players: Map<string, RoomPlayer>, seatId: string, keeperId: string): void {
  for (const [playerId, player] of players) {
    if (playerId !== keeperId && player.seatId === seatId) {
      players.set(playerId, { ...player, seatId: null });
    }
  }
}

function placePlayer(players: Map<string, RoomPlayer>, player: RoomPlayer): void {
  if (player.seatId !== null) vacateSeat(players, player.seatId, player.playerId);
  players.set(player.playerId, player);
}

function roomPlayer(wire: WirePlayer): RoomPlayer {
  return {
    playerId: wire.playerId,
    x: wire.position.x,
    z: wire.position.z,
    yaw: wire.yaw,
    seatId: wire.seatId ?? null,
  };
}

function seatsOf(players: ReadonlyMap<string, RoomPlayer>): Map<string, string> {
  const seats = new Map<string, string>();
  for (const player of players.values()) {
    if (player.seatId !== null) seats.set(player.seatId, player.playerId);
  }
  return seats;
}

function withPlayers(room: RoomState, players: Map<string, RoomPlayer>): RoomState {
  return { ...room, players, seats: seatsOf(players) };
}

export function withoutDenial(room: RoomState): RoomState {
  return room.denied ? { ...room, denied: null } : room;
}

export function applyServerMessage(room: RoomState, message: ServerMessage): RoomState {
  switch (message.kind) {
    case 'snapshot': {
      const players = new Map<string, RoomPlayer>();
      for (const wire of message.players) placePlayer(players, roomPlayer(wire));
      return { ...withPlayers(room, players), tick: message.tick, error: null };
    }
    case 'delta': {
      if (message.tick < room.tick) return room;
      const players = new Map(room.players);
      for (const wire of message.changed ?? []) placePlayer(players, roomPlayer(wire));
      for (const playerId of message.left ?? []) players.delete(playerId);
      return { ...withPlayers(room, players), tick: message.tick };
    }
    case 'seat.granted': {
      const holder = room.players.get(message.playerId);
      if (!holder) return room;
      const players = new Map(room.players);
      placePlayer(players, { ...holder, seatId: message.seatId });
      return withPlayers(room, players);
    }
    case 'seat.denied':
      return { ...room, denied: { seatId: message.seatId, reason: message.reason } };
    case 'error':
      return {
        ...room,
        error:
          message.message === undefined
            ? { code: message.code }
            : { code: message.code, message: message.message },
      };
  }
}
