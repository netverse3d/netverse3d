import {
  SEAT_PULL,
  chairComesHome,
  seatMotion,
  seatMotionLength,
  slideBack,
} from '@netverse/game-assets/runtime/seat-motion.mjs';
import type { SeatClipLengths } from '@netverse/game-assets/runtime/seat-motion.mjs';
import type { PlayerState } from '@netverse/game-shared/movement';

export interface SeatSpot {
  readonly seatId: string;
  readonly sit: PlayerState;
}

export interface SeatFrame<T extends SeatSpot> {
  readonly seat: T | null;
  readonly chair: number;
  readonly hold: PlayerState | null;
  readonly clip: string | null;
}

export interface SeatDrive<T extends SeatSpot> {
  sit(seat: T, from: PlayerState): void;
  seat(seat: T): void;
  stand(): void;
  seated(): boolean;
  step(delta: number, player: PlayerState): SeatFrame<T>;
}

type Phase = 'free' | 'sitting' | 'seated' | 'standing' | 'stepping' | 'away' | 'homing';

const STEP_SECONDS = 0.35;
const HOME_SECONDS = 0.45;
const WALK_CLIP = 'walk';
const TYPING_CLIP = 'typing';

function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function turn(from: number, to: number, t: number): number {
  const full = Math.PI * 2;
  const delta = ((((to - from) % full) + full + Math.PI) % full) - Math.PI;
  return from + delta * t;
}

function between(from: PlayerState, to: PlayerState, t: number): PlayerState {
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    yaw: turn(from.yaw, to.yaw, t),
  };
}

function pulled(sit: PlayerState, distance: number): PlayerState {
  const [dx, dz] = slideBack(sit.yaw, distance);
  return { x: sit.x + dx, z: sit.z + dz, yaw: sit.yaw };
}

export function createSeatDrive<T extends SeatSpot>(clips: SeatClipLengths): SeatDrive<T> {
  let phase: Phase = 'free';
  let seat: T | null = null;
  let origin: PlayerState | null = null;
  let elapsed = 0;
  let announced = false;

  const idle = (): SeatFrame<T> => ({ seat: null, chair: 0, hold: null, clip: null });

  return {
    sit(next, from) {
      seat = next;
      origin = from;
      phase = 'sitting';
      elapsed = 0;
    },
    seat(next) {
      seat = next;
      origin = next.sit;
      phase = 'seated';
      announced = false;
    },
    stand() {
      if (phase !== 'seated' && phase !== 'sitting') return;
      phase = 'standing';
      elapsed = 0;
    },
    seated() {
      return phase === 'seated' || phase === 'sitting';
    },
    step(delta, player) {
      if (!seat || !origin || phase === 'free') return idle();
      const spot = seat;
      const stood = origin;
      const before = elapsed;
      elapsed += delta;
      if (phase === 'sitting') {
        const motion = seatMotion('sit', elapsed, clips);
        if (motion.done) {
          phase = 'seated';
          announced = true;
          return { seat: spot, chair: 0, hold: spot.sit, clip: TYPING_CLIP };
        }
        if (motion.actor === null) {
          const way = motion.chair / SEAT_PULL;
          return {
            seat: spot,
            chair: motion.chair,
            hold: between(stood, pulled(spot.sit, SEAT_PULL), way),
            clip: WALK_CLIP,
          };
        }
        return {
          seat: spot,
          chair: motion.chair,
          hold: pulled(spot.sit, motion.actor),
          clip: motion.clip,
        };
      }
      if (phase === 'seated') {
        const clip = announced ? null : TYPING_CLIP;
        announced = true;
        return { seat: spot, chair: 0, hold: spot.sit, clip };
      }
      if (phase === 'standing') {
        const motion = seatMotion('stand', elapsed, clips);
        if (!motion.done) {
          return {
            seat: spot,
            chair: motion.chair,
            hold: pulled(spot.sit, motion.actor ?? 0),
            clip: motion.clip,
          };
        }
        phase = 'stepping';
        elapsed -= seatMotionLength('stand', clips);
      }
      if (phase === 'stepping') {
        if (elapsed < STEP_SECONDS) {
          return {
            seat: spot,
            chair: SEAT_PULL,
            hold: between(pulled(spot.sit, SEAT_PULL), stood, ease(elapsed / STEP_SECONDS)),
            clip: WALK_CLIP,
          };
        }
        phase = 'away';
        return { seat: spot, chair: SEAT_PULL, hold: null, clip: null };
      }
      if (phase === 'away') {
        if (!chairComesHome(spot.sit, player)) {
          return { seat: spot, chair: SEAT_PULL, hold: null, clip: null };
        }
        phase = 'homing';
        elapsed = elapsed - before;
      }
      if (elapsed < HOME_SECONDS) {
        return {
          seat: spot,
          chair: SEAT_PULL * (1 - ease(elapsed / HOME_SECONDS)),
          hold: null,
          clip: null,
        };
      }
      phase = 'free';
      seat = null;
      return { seat: spot, chair: 0, hold: null, clip: null };
    },
  };
}
