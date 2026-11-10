import type { FloorBox } from './movement.ts';

export interface KitAnchor {
  readonly position: readonly number[];
  readonly scale: readonly number[];
}

export type KitAnchors = Readonly<Record<string, Readonly<Record<string, KitAnchor>>>>;

export interface Placement {
  readonly part: string;
  readonly position: readonly number[];
  readonly yaw: number;
}

export const COLLISION_ANCHOR_PREFIX = 'collision_';

const PRECISION = 1e6;

function roundEdge(value: number): number {
  return Math.round(value * PRECISION) / PRECISION + 0;
}

function measure(values: readonly number[] | undefined, index: number, owner: string): number {
  const value = values?.[index];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${owner} has a broken measurement`);
  }
  return value;
}

function halfSize(values: readonly number[] | undefined, index: number, owner: string): number {
  const value = measure(values, index, owner);
  if (value <= 0) throw new TypeError(`${owner} has no size`);
  return value;
}

export function collisionBoxes(placements: readonly Placement[], anchors: KitAnchors): FloorBox[] {
  const boxes: FloorBox[] = [];
  for (const { part, position, yaw } of placements) {
    const colliders = Object.entries(anchors[part] ?? {}).filter(([name]) =>
      name.startsWith(COLLISION_ANCHOR_PREFIX),
    );
    if (!Number.isFinite(yaw)) throw new TypeError(`${part} has a broken measurement`);
    const originX = measure(position, 0, part);
    const originZ = measure(position, 2, part);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (const [name, anchor] of colliders) {
      const owner = `${part} ${name}`;
      const localX = measure(anchor?.position, 0, owner);
      const localZ = measure(anchor?.position, 2, owner);
      const halfWidth = halfSize(anchor?.scale, 0, owner);
      const halfDepth = halfSize(anchor?.scale, 2, owner);
      const centreX = originX + localX * cos + localZ * sin;
      const centreZ = originZ + localZ * cos - localX * sin;
      const reachX = Math.abs(cos) * halfWidth + Math.abs(sin) * halfDepth;
      const reachZ = Math.abs(sin) * halfWidth + Math.abs(cos) * halfDepth;
      boxes.push({
        minX: roundEdge(centreX - reachX),
        maxX: roundEdge(centreX + reachX),
        minZ: roundEdge(centreZ - reachZ),
        maxZ: roundEdge(centreZ + reachZ),
      });
    }
  }
  return boxes;
}
