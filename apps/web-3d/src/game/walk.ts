import { stepPlayer } from '@netverse/game-shared/movement';
import type { FloorBox, PlayerState } from '@netverse/game-shared/movement';
import {
  advanceSimulation,
  createSimulation,
  interpolatePlayer,
} from '@netverse/game-shared/simulation';

import { clipFor, worldIntent } from './input.ts';
import type { LocalIntent, MoveClip } from './input.ts';

export interface WalkFrame {
  readonly player: PlayerState;
  readonly clip: MoveClip | null;
}

export interface Walk {
  advance(frameSeconds: number, local: LocalIntent, cameraYaw: number): WalkFrame;
  place(spawn: PlayerState, obstacles: readonly FloorBox[]): void;
  position(): PlayerState;
  hold(spot: PlayerState): void;
  release(): void;
  held(): boolean;
}

export function createWalk(spawn: PlayerState, obstacles: readonly FloorBox[]): Walk {
  let simulation = createSimulation(spawn);
  let boxes = obstacles;
  let heldAt: PlayerState | null = null;
  let resume: PlayerState | null = null;
  return {
    advance(frameSeconds, local, cameraYaw) {
      if (heldAt) return { player: heldAt, clip: null };
      const intent = worldIntent(local, cameraYaw);
      simulation = advanceSimulation(simulation, frameSeconds, (player, seconds) =>
        stepPlayer(player, intent, boxes, seconds),
      );
      return {
        player: interpolatePlayer(simulation.previous, simulation.current, simulation.alpha),
        clip: clipFor(intent),
      };
    },
    place(next, nextObstacles) {
      simulation = createSimulation(next);
      boxes = nextObstacles;
      heldAt = null;
      resume = null;
    },
    hold(spot) {
      if (!heldAt) resume = simulation.current;
      heldAt = spot;
    },
    release() {
      if (!heldAt) return;
      heldAt = null;
      simulation = createSimulation(resume ?? simulation.current);
      resume = null;
    },
    held() {
      return heldAt !== null;
    },
    position() {
      return simulation.current;
    },
  };
}
