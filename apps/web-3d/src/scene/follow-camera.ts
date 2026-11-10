import type { FloorBox, FloorPoint } from '@netverse/game-shared/movement';

export interface CameraOrbit {
  readonly yaw: number;
  readonly pitch: number;
  readonly distance: number;
}

export type Point3 = readonly [number, number, number];
export type CutPlane = readonly [number, number, number, number];

export interface CameraPose {
  readonly eye: Point3;
  readonly target: Point3;
}

export const LOOK_HEIGHT = 1.1;
export const MIN_PITCH = 0.6;
export const MAX_PITCH = 1.2;
export const MIN_DISTANCE = 7;
export const MAX_DISTANCE = 26;
export const TURN_PER_PIXEL = 0.005;
export const ZOOM_PER_NOTCH = 1.12;
export const CAMERA_FIELD_OF_VIEW = 35;
export const CORNER_VIEW_TURN = Math.PI / 4;
export const CEILING_CUT_HEIGHT = 2.6;
export const DEFAULT_ORBIT: CameraOrbit = { yaw: 0, pitch: 0.8, distance: 13 };

const CUT_OFF = 1e6;

function between(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
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

export function zoomOrbit(orbit: CameraOrbit, notchesOut: number): CameraOrbit {
  if (!Number.isFinite(notchesOut)) return orbit;
  const distance = orbit.distance * ZOOM_PER_NOTCH ** notchesOut;
  return { ...orbit, distance: between(distance, MIN_DISTANCE, MAX_DISTANCE) };
}

export function cameraPose(player: FloorPoint, orbit: CameraOrbit): CameraPose {
  const flat = Math.cos(orbit.pitch) * orbit.distance;
  return {
    eye: [
      player.x - Math.sin(orbit.yaw) * flat,
      LOOK_HEIGHT + Math.sin(orbit.pitch) * orbit.distance,
      player.z - Math.cos(orbit.yaw) * flat,
    ],
    target: [player.x, LOOK_HEIGHT, player.z],
  };
}

export function cutaways(eye: Point3, room: FloorBox): CutPlane[] {
  const [x, y, z] = eye;
  return [
    [-1, 0, 0, x > room.maxX ? room.maxX : CUT_OFF],
    [1, 0, 0, x < room.minX ? -room.minX : CUT_OFF],
    [0, 0, -1, z > room.maxZ ? room.maxZ : CUT_OFF],
    [0, 0, 1, z < room.minZ ? -room.minZ : CUT_OFF],
    [0, -1, 0, y > CEILING_CUT_HEIGHT ? CEILING_CUT_HEIGHT : CUT_OFF],
  ];
}
