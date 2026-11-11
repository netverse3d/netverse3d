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
export const MIN_PITCH = 0.12;
export const MAX_PITCH = 1.2;
export const MIN_DISTANCE = 1.8;
export const MAX_DISTANCE = 26;
export const TURN_PER_PIXEL = 0.005;
export const ZOOM_PER_NOTCH = 1.12;
export const FAR_FIELD_OF_VIEW = 35;
export const NEAR_FIELD_OF_VIEW = 58;
export const OVERVIEW_DISTANCE = 10;
export const CORNER_VIEW_TURN = Math.PI / 4;
export const CEILING_CUT_HEIGHT = 3.2;
export const WALL_CUT_PLANES = 4;
export const FURNITURE_HEIGHT = 1.4;
export const CAMERA_CLEARANCE = 0.12;
export const MIN_CAMERA_REACH = 0.9;
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

export type WallSide = 'north' | 'south' | 'east' | 'west';

export function wallIsCut(eye: Point3, room: FloorBox, wall: WallSide): boolean {
  const [x, , z] = eye;
  return {
    east: x > room.maxX,
    west: x < room.minX,
    south: z > room.maxZ,
    north: z < room.minZ,
  }[wall];
}

function entryInto(box: FloorBox, from: Point3, to: Point3): number | null {
  let enter = 0;
  let leave = 1;
  const spans: [number, number, number, number][] = [
    [from[0], to[0] - from[0], box.minX - CAMERA_CLEARANCE, box.maxX + CAMERA_CLEARANCE],
    [from[2], to[2] - from[2], box.minZ - CAMERA_CLEARANCE, box.maxZ + CAMERA_CLEARANCE],
  ];
  for (const [start, travel, low, high] of spans) {
    if (travel === 0) {
      if (start < low || start > high) return null;
      continue;
    }
    const first = (low - start) / travel;
    const second = (high - start) / travel;
    enter = Math.max(enter, Math.min(first, second));
    leave = Math.min(leave, Math.max(first, second));
  }
  return enter <= leave ? enter : null;
}

export function clearEye(pose: CameraPose, furniture: readonly FloorBox[]): Point3 {
  const { eye, target } = pose;
  if (eye[1] >= CEILING_CUT_HEIGHT) return eye;
  const length = Math.sqrt(
    (eye[0] - target[0]) ** 2 + (eye[1] - target[1]) ** 2 + (eye[2] - target[2]) ** 2,
  );
  if (length === 0) return eye;
  let reach = 1;
  for (const box of furniture) {
    const entry = entryInto(box, target, eye);
    if (entry === null || entry <= 0 || entry >= reach) continue;
    const height = target[1] + (eye[1] - target[1]) * entry;
    if (height < FURNITURE_HEIGHT) reach = entry;
  }
  if (reach === 1) return eye;
  const kept = Math.min(Math.max(reach, MIN_CAMERA_REACH / length), 1);
  return [
    target[0] + (eye[0] - target[0]) * kept,
    target[1] + (eye[1] - target[1]) * kept,
    target[2] + (eye[2] - target[2]) * kept,
  ];
}

export function eyeDistance(eye: Point3, target: Point3): number {
  return Math.sqrt(
    (eye[0] - target[0]) ** 2 + (eye[1] - target[1]) ** 2 + (eye[2] - target[2]) ** 2,
  );
}

export function fieldOfView(distance: number): number {
  const closeness = between(
    (OVERVIEW_DISTANCE - distance) / (OVERVIEW_DISTANCE - MIN_DISTANCE),
    0,
    1,
  );
  return FAR_FIELD_OF_VIEW + (NEAR_FIELD_OF_VIEW - FAR_FIELD_OF_VIEW) * closeness;
}
