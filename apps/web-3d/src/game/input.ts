import type { MoveIntent } from '@netverse/game-shared/movement';

export interface LocalIntent {
  readonly right: number;
  readonly forward: number;
  readonly run: boolean;
}

export interface StickPosition {
  readonly x: number;
  readonly y: number;
}

export type MoveClip = 'idle' | 'walk' | 'run';

export const STILL: LocalIntent = { right: 0, forward: 0, run: false };
export const STICK_DEAD_ZONE = 0.15;
export const STICK_RUN_THRESHOLD = 0.9;

const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RUN_KEYS = ['ShiftLeft', 'ShiftRight'];

export const USE_KEY = 'KeyE';

export const CONTROL_KEYS: ReadonlySet<string> = new Set([
  ...FORWARD_KEYS,
  ...BACK_KEYS,
  ...RIGHT_KEYS,
  ...LEFT_KEYS,
  ...RUN_KEYS,
]);

function held(pressed: ReadonlySet<string>, codes: readonly string[]): number {
  return codes.some((code) => pressed.has(code)) ? 1 : 0;
}

export function keysIntent(pressed: ReadonlySet<string>): LocalIntent {
  const right = held(pressed, RIGHT_KEYS) - held(pressed, LEFT_KEYS);
  const forward = held(pressed, FORWARD_KEYS) - held(pressed, BACK_KEYS);
  const size = Math.sqrt(right * right + forward * forward);
  if (size === 0) return STILL;
  return { right: right / size, forward: forward / size, run: held(pressed, RUN_KEYS) === 1 };
}

export function stickIntent(stick: StickPosition): LocalIntent {
  if (!Number.isFinite(stick.x) || !Number.isFinite(stick.y)) return STILL;
  const size = Math.sqrt(stick.x * stick.x + stick.y * stick.y);
  if (size <= STICK_DEAD_ZONE) return STILL;
  const push = Math.min(size, 1);
  const strength = (push - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
  return {
    right: (stick.x / size) * strength,
    forward: (stick.y / size) * strength,
    run: push >= STICK_RUN_THRESHOLD,
  };
}

export function worldIntent(local: LocalIntent, cameraYaw: number): MoveIntent {
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  return {
    x: local.forward * sin - local.right * cos,
    z: local.forward * cos + local.right * sin,
    run: local.run,
  };
}

export function clipFor(intent: MoveIntent): MoveClip {
  if (intent.x === 0 && intent.z === 0) return 'idle';
  return intent.run ? 'run' : 'walk';
}
