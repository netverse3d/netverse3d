import type { PlayerState } from './movement.ts';

export interface Simulation<State> {
  readonly tick: number;
  readonly carry: number;
  readonly alpha: number;
  readonly previous: State;
  readonly current: State;
}

export type SimulationStep<State> = (state: State, seconds: number, tick: number) => State;

export const TICK_RATE = 30;
export const TICK_SECONDS = 1 / TICK_RATE;
export const MAX_TICKS_PER_FRAME = 5;

const FULL_TURN = Math.PI * 2;

export function createSimulation<State>(state: State): Simulation<State> {
  return { tick: 0, carry: 0, alpha: 0, previous: state, current: state };
}

export function advanceSimulation<State>(
  simulation: Simulation<State>,
  frameSeconds: number,
  step: SimulationStep<State>,
): Simulation<State> {
  const elapsed = Number.isFinite(frameSeconds) && frameSeconds > 0 ? frameSeconds : 0;
  const waiting = simulation.carry + elapsed;
  const due = Math.floor(waiting / TICK_SECONDS);
  const ticks = Math.min(due, MAX_TICKS_PER_FRAME);
  const carry = due > MAX_TICKS_PER_FRAME ? 0 : waiting - due * TICK_SECONDS;
  let { previous, current } = simulation;
  for (let offset = 0; offset < ticks; offset += 1) {
    previous = current;
    current = step(current, TICK_SECONDS, simulation.tick + offset);
  }
  return { tick: simulation.tick + ticks, carry, alpha: carry / TICK_SECONDS, previous, current };
}

function shortestTurn(from: number, to: number): number {
  const turn = to - from;
  return turn - FULL_TURN * Math.round(turn / FULL_TURN);
}

export function interpolatePlayer(
  previous: PlayerState,
  current: PlayerState,
  alpha: number,
): PlayerState {
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    z: previous.z + (current.z - previous.z) * alpha,
    yaw: previous.yaw + shortestTurn(previous.yaw, current.yaw) * alpha,
  };
}
