import type { FloorBox, FloorPoint } from '@netverse/game-shared/movement';

export interface CameraOrbit {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
}

export type Point3 = readonly [number, number, number];

export interface CameraPose {
  readonly eye: Point3;
  readonly target: Point3;
}

export const LOOK_HEIGHT = 1.25;
export const MIN_PITCH = 0.05;
export const MAX_PITCH = 1.2;
export const CAMERA_WALL_MARGIN = 0.15;
export const MAX_EYE_HEIGHT = 2.45;
export const TURN_PER_PIXEL = 0.005;
export const DEFAULT_ORBIT: CameraOrbit = { yaw: 0, pitch: 0.38, distance: 3.2 };

function between(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function reach(from: number, offset: number, low: number, high: number): number {
  if (offset === 0) return 1;
  const limit = offset < 0 ? low : high;
  return between((limit - from) / offset, 0, 1);
}

export function turnOrbit(
  orbit: CameraOrbit,
  pixelsRight: number,
  pixelsDown: number,
): CameraOrbit {
  if (!Number.isFinite(pixelsRight) || !Number.isFinite(pixelsDown)) return orbit;
  return {
    yaw: orbit.yaw - pixelsRight * TURN_PER_PIXEL,
    pitch: between(orbit.pitch + pixelsDown * TURN_PER_PIXEL, MIN_PITCH, MAX_PITCH),
    distance: orbit.distance,
  };
}

export function cameraPose(player: FloorPoint, orbit: CameraOrbit, room: FloorBox): CameraPose {
  const flat = Math.cos(orbit.pitch) * orbit.distance;
  const offsetX = -Math.sin(orbit.yaw) * flat;
  const offsetZ = -Math.cos(orbit.yaw) * flat;
  const pull = Math.min(
    reach(player.x, offsetX, room.minX + CAMERA_WALL_MARGIN, room.maxX - CAMERA_WALL_MARGIN),
    reach(player.z, offsetZ, room.minZ + CAMERA_WALL_MARGIN, room.maxZ - CAMERA_WALL_MARGIN),
  );
  const allowed = flat * pull;
  const rise = Math.sqrt(Math.max(orbit.distance * orbit.distance - allowed * allowed, 0));
  return {
    eye: [
      player.x + offsetX * pull,
      Math.min(LOOK_HEIGHT + rise, MAX_EYE_HEIGHT),
      player.z + offsetZ * pull,
    ],
    target: [player.x, LOOK_HEIGHT, player.z],
  };
}
