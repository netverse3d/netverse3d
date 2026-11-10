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
  readonly clip: MoveClip;
}

export interface Walk {
  advance(frameSeconds: number, local: LocalIntent, cameraYaw: number): WalkFrame;
  place(spawn: PlayerState, obstacles: readonly FloorBox[]): void;
}

export function createWalk(spawn: PlayerState, obstacles: readonly FloorBox[]): Walk {
  let simulation = createSimulation(spawn);
  let boxes = obstacles;
  return {
    advance(frameSeconds, local, cameraYaw) {
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
    },
  };
}
