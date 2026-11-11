declare module '@netverse/game-assets/runtime/shop-look.mjs' {
  export type Wall = 'north' | 'south' | 'east' | 'west';
  export type Vector3Tuple = [number, number, number];

  export interface Opening {
    wall: Wall;
    at: number;
  }

  export interface ShopRecipe {
    id: string;
    name: string;
    palette: Record<string, string[]>;
    emissive?: Record<string, string[]>;
    variants: Record<string, string>;
    layout: {
      cells: [number, number];
      stations: { cell: [number, number]; facing: Wall }[];
      door: Opening;
      windows?: Opening[];
    };
    sign: { text: string; style?: 'neon' | 'led' | 'painted' };
    lighting: 'neon' | 'dim' | 'warm' | 'daylight';
  }

  export interface PaletteConfig {
    surface: string[];
    glow: string[];
    images?: string[];
  }

  export interface PaletteImage {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export interface Anchor {
    position: Vector3Tuple;
    scale: Vector3Tuple;
  }

  export type KitAnchors = Record<string, Record<string, Anchor>>;

  export interface Placement {
    station?: number;
    slot: string;
    part: string;
    position: Vector3Tuple;
    yaw: number;
  }

  export const PALETTE_WIDTH: number;
  export function paletteRows(palette: PaletteConfig): string[];
  export function colorAt(stops: string[], u: number): Vector3Tuple;
  export function paletteImage(
    rows: string[],
    stopsByRow: Record<string, string[]>,
    width?: number,
  ): PaletteImage;
  export function kitAnchors(gltf: unknown): KitAnchors;
  export function stationPlan(variants: Record<string, string>, anchors: KitAnchors): Placement[];
  export function shopPlan(recipe: ShopRecipe, anchors: KitAnchors): Placement[];
  export function roomPlan(recipe: ShopRecipe): Placement[];
  export function doorwayCell(opening: Opening, cells: [number, number]): [number, number];
  export function instanceGroups(plan: Placement[]): Map<string, Placement[]>;
  export function drawCalls(gltf: unknown, plan: Placement[]): number;
}

declare module '@netverse/game-assets/runtime/three-shop.mjs' {
  import type { Group, MeshBasicMaterial, MeshStandardMaterial, Object3D, Texture } from 'three';
  import type {
    PaletteImage,
    Placement,
    ShopRecipe,
  } from '@netverse/game-assets/runtime/shop-look.mjs';

  export interface ShopMaterials {
    surface: MeshStandardMaterial;
    glow: MeshBasicMaterial;
    display: MeshBasicMaterial;
    decal: MeshBasicMaterial;
    legend: MeshStandardMaterial;
  }

  export function paletteTexture(THREE: typeof import('three'), image: PaletteImage): Texture;
  export function shopMaterials(
    THREE: typeof import('three'),
    recipe: ShopRecipe,
    rows: string[],
    options?: {
      roughness?: number;
      glowBoost?: number;
      lightmap?: Texture | null;
      lightmapIntensity?: number;
      legends?: Texture | { map: Texture | null; emissive?: Texture | null } | null;
    },
  ): ShopMaterials;
  export function kitLightmap(kitScene: Object3D): Texture | null;
  export function buildShop(
    THREE: typeof import('three'),
    kitScene: Object3D,
    plan: Placement[],
    materials: ShopMaterials,
  ): Group;
}

declare module '@netverse/game-assets/runtime/shop-sign.mjs' {
  import type { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
  import type { ShopRecipe } from '@netverse/game-assets/runtime/shop-look.mjs';

  export interface SignPlacement {
    position: [number, number, number];
    yaw: number;
    size: [number, number];
  }

  export interface SignStyle {
    text: string;
    color: string;
    background: string | null;
    glow: number;
    passes: number;
  }

  export type ShopSign = Mesh<PlaneGeometry, MeshBasicMaterial>;

  export function signPlacement(recipe: ShopRecipe): SignPlacement;
  export function signStyle(recipe: ShopRecipe): SignStyle;
  export function paintSign(canvas: HTMLCanvasElement, style: SignStyle): HTMLCanvasElement;
  export function buildSign(
    THREE: typeof import('three'),
    recipe: ShopRecipe,
    canvas: HTMLCanvasElement,
  ): ShopSign;
  export function repaintSign(sign: ShopSign, recipe: ShopRecipe): void;
}

declare module '@netverse/game-assets/runtime/actor-look.mjs' {
  import type { Material, Object3D, Texture } from 'three';

  export interface ActorLook {
    faceTexture(kind: string, blink?: boolean): Texture;
    emblemTexture(): Texture;
    material(source: Material, soft?: boolean): Material;
    dress<T extends Object3D>(root: T, options?: { soft?: boolean }): T;
    showFace(root: Object3D, kind: string, blink?: boolean): boolean;
  }

  export function createActorLook(
    THREE: typeof import('three'),
    options?: { createCanvas?: () => HTMLCanvasElement; toonGradient?: Texture | null },
  ): ActorLook;
}
