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
  takeZoom(): number;
  dispose(): void;
}

interface KeyPress extends Event {
  readonly code: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
}

interface Touch extends Event {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerType: string;
  readonly button?: number;
  readonly buttons?: number;
}

interface Scroll extends Event {
  readonly deltaY: number;
}

interface Drag {
  x: number;
  y: number;
}

export const STICK_RADIUS_PIXELS = 56;

const TYPING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const NO_TURN: Turn = { right: 0, down: 0 };
const MAIN_BUTTON = 0;
const WHEEL_PIXELS_PER_NOTCH = 100;

function isTyping(event: Event): boolean {
  const tagName = (event.target as { tagName?: unknown } | null)?.tagName;
  return typeof tagName === 'string' && TYPING_TAGS.has(tagName);
}

function isShortcut(press: KeyPress): boolean {
  return Boolean(press.ctrlKey || press.metaKey || press.altKey);
}

export function createControls(surface: ControlSurface, keys: KeySource): Controls {
  const pressed = new Set<string>();
  const looks = new Map<number, Drag>();
  let stickPointer: number | null = null;
  let stickOrigin: Drag = { x: 0, y: 0 };
  let stick: StickPosition | null = null;
  let turn: Turn = NO_TURN;
  let zoom = 0;

  const release = (pointerId: number) => {
    looks.delete(pointerId);
    if (pointerId === stickPointer) {
      stickPointer = null;
      stick = null;
    }
  };
  const releaseAll = () => {
    pressed.clear();
    looks.clear();
    stickPointer = null;
    stick = null;
  };

  const onKeyDown = (event: Event) => {
    const press = event as KeyPress;
    if (isShortcut(press)) {
      pressed.clear();
      return;
    }
    if (!CONTROL_KEYS.has(press.code) || isTyping(event)) return;
    pressed.add(press.code);
    event.preventDefault();
  };
  const onKeyUp = (event: Event) => {
    pressed.delete((event as KeyPress).code);
  };
  const onPointerDown = (event: Event) => {
    const touch = event as Touch;
    const isTouch = touch.pointerType === 'touch';
    if (!isTouch && (touch.button ?? MAIN_BUTTON) !== MAIN_BUTTON) return;
    const { left, width } = surface.getBoundingClientRect();
    const onLeftHalf = touch.clientX < left + width / 2;
    if (isTouch && onLeftHalf) {
      if (stickPointer !== null) return;
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
    if (touch.pointerType !== 'touch' && touch.buttons === 0) {
      release(touch.pointerId);
      return;
    }
    turn = {
      right: turn.right + touch.clientX - last.x,
      down: turn.down + touch.clientY - last.y,
    };
    last.x = touch.clientX;
    last.y = touch.clientY;
  };
  const onPointerEnd = (event: Event) => {
    release((event as Touch).pointerId);
  };
  const onContextMenu = (event: Event) => {
    event.preventDefault();
  };
  const onWheel = (event: Event) => {
    const { deltaY } = event as Scroll;
    if (Number.isFinite(deltaY)) zoom += deltaY / WHEEL_PIXELS_PER_NOTCH;
    event.preventDefault();
  };

  const keyListeners: [string, (event: Event) => void][] = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['blur', releaseAll],
  ];
  const surfaceListeners: [string, (event: Event) => void][] = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerEnd],
    ['pointercancel', onPointerEnd],
    ['lostpointercapture', onPointerEnd],
    ['contextmenu', onContextMenu],
    ['wheel', onWheel],
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
    takeZoom() {
      const taken = zoom;
      zoom = 0;
      return taken;
    },
    dispose() {
      for (const [type, listener] of keyListeners) keys.removeEventListener(type, listener);
      for (const [type, listener] of surfaceListeners) surface.removeEventListener(type, listener);
      releaseAll();
      turn = NO_TURN;
      zoom = 0;
    },
  };
}
