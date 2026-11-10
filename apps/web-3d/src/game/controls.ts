import { CONTROL_KEYS, STILL, keysIntent, stickIntent } from './input.ts';
import type { LocalIntent, StickPosition } from './input.ts';

type Listen = (type: string, listener: (event: Event) => void) => void;

export interface ControlSurface {
  addEventListener: Listen;
  removeEventListener: Listen;
  getBoundingClientRect(): { left: number; width: number };
  setPointerCapture(pointerId: number): void;
}

export interface KeySource {
  addEventListener: Listen;
  removeEventListener: Listen;
}

export interface Turn {
  readonly right: number;
  readonly down: number;
}

export interface Controls {
  intent(): LocalIntent;
  takeTurn(): Turn;
  dispose(): void;
}

interface KeyPress extends Event {
  readonly code: string;
}

interface Touch extends Event {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerType: string;
}

interface Drag {
  x: number;
  y: number;
}

export const STICK_RADIUS_PIXELS = 56;

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const NO_TURN: Turn = { right: 0, down: 0 };

function isTyping(event: Event): boolean {
  const tagName = (event.target as { tagName?: unknown } | null)?.tagName;
  return typeof tagName === 'string' && TYPING_TAGS.has(tagName);
}

export function createControls(surface: ControlSurface, keys: KeySource): Controls {
  const pressed = new Set<string>();
  const looks = new Map<number, Drag>();
  let stickPointer: number | null = null;
  let stickOrigin: Drag = { x: 0, y: 0 };
  let stick: StickPosition | null = null;
  let turn: Turn = NO_TURN;

  const onKeyDown = (event: Event) => {
    const { code } = event as KeyPress;
    if (!CONTROL_KEYS.has(code) || isTyping(event)) return;
    pressed.add(code);
    event.preventDefault();
  };
  const onKeyUp = (event: Event) => {
    pressed.delete((event as KeyPress).code);
  };
  const onBlur = () => {
    pressed.clear();
  };
  const onPointerDown = (event: Event) => {
    const touch = event as Touch;
    const { left, width } = surface.getBoundingClientRect();
    const onLeftHalf = touch.clientX < left + width / 2;
    if (touch.pointerType === 'touch' && onLeftHalf && stickPointer === null) {
      stickPointer = touch.pointerId;
      stickOrigin = { x: touch.clientX, y: touch.clientY };
      stick = { x: 0, y: 0 };
    } else {
      looks.set(touch.pointerId, { x: touch.clientX, y: touch.clientY });
    }
    surface.setPointerCapture(touch.pointerId);
  };
  const onPointerMove = (event: Event) => {
    const touch = event as Touch;
    if (touch.pointerId === stickPointer) {
      stick = {
        x: (touch.clientX - stickOrigin.x) / STICK_RADIUS_PIXELS,
        y: (stickOrigin.y - touch.clientY) / STICK_RADIUS_PIXELS,
      };
      return;
    }
    const last = looks.get(touch.pointerId);
    if (!last) return;
    turn = {
      right: turn.right + touch.clientX - last.x,
      down: turn.down + touch.clientY - last.y,
    };
    last.x = touch.clientX;
    last.y = touch.clientY;
  };
  const onPointerEnd = (event: Event) => {
    const { pointerId } = event as Touch;
    looks.delete(pointerId);
    if (pointerId === stickPointer) {
      stickPointer = null;
      stick = null;
    }
  };

  const keyListeners: [string, (event: Event) => void][] = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['blur', onBlur],
  ];
  const surfaceListeners: [string, (event: Event) => void][] = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerEnd],
    ['pointercancel', onPointerEnd],
  ];
  for (const [type, listener] of keyListeners) keys.addEventListener(type, listener);
  for (const [type, listener] of surfaceListeners) surface.addEventListener(type, listener);

  return {
    intent() {
      const pushed = stick ? stickIntent(stick) : STILL;
      return pushed === STILL ? keysIntent(pressed) : pushed;
    },
    takeTurn() {
      const taken = turn;
      turn = NO_TURN;
      return taken;
    },
    dispose() {
      for (const [type, listener] of keyListeners) keys.removeEventListener(type, listener);
      for (const [type, listener] of surfaceListeners) surface.removeEventListener(type, listener);
      pressed.clear();
      looks.clear();
      stickPointer = null;
      stick = null;
      turn = NO_TURN;
    },
  };
}
