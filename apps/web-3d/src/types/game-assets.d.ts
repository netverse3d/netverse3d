declare module '@netverse/game-assets/runtime/lighting.mjs' {
  import type { Light, Scene, WebGLRenderer } from 'three';

  export interface LightingPreset {
    id: string;
    exposure: number;
    environment: {
      source: string;
      intensity: number;
      blur: number;
    };
  }

  export interface LightingHandle {
    readonly preset: LightingPreset;
    readonly lights: Light[];
    update(
      next:
        string | { [key: string]: unknown; environment?: Partial<LightingPreset['environment']> },
    ): LightingHandle;
    setExposure(value: number): LightingHandle;
    dispose(): void;
  }

  export function lightingFor(name: string): LightingPreset;
  export function createBloomPass<
    TPass extends { strength: number; radius: number; threshold: number },
  >(
    THREE: typeof import('three'),
    BloomPass: new (
      resolution: import('three').Vector2,
      strength: number,
      radius: number,
      threshold: number,
    ) => TPass,
    presetName?: string,
  ): TPass;
  export function applyLighting(
    THREE: typeof import('three'),
    options: {
      scene: Scene;
      renderer: WebGLRenderer;
      bloomPass?: { strength: number; radius: number; threshold: number };
      preset: string | LightingPreset;
      room?: { width: number; depth: number };
      RoomEnvironment?: new () => Scene;
    },
  ): LightingHandle;
}

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
    extra?: { surface?: string[]; glow?: string[] };
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
  export function placeInstance(
    THREE: typeof import('three'),
    shop: Object3D,
    part: string,
    index: number,
    position: readonly number[],
    yaw: number,
  ): void;
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

declare module '@netverse/game-assets/runtime/seat-motion.mjs' {
  export interface SeatClipLengths {
    readonly sit_down: number;
    readonly stand_up: number;
  }
  export interface SeatMotion {
    readonly chair: number;
    readonly actor: number | null;
    readonly clip: string | null;
    readonly done: boolean;
  }
  export const SEAT_PULL: number;
  export const STAND_GAP: number;
  export const SEAT_OUT: number;
  export function seatMotion(
    action: 'sit' | 'stand',
    elapsed: number,
    clips: SeatClipLengths,
  ): SeatMotion;
  export function seatMotionLength(action: 'sit' | 'stand', clips: SeatClipLengths): number;
  export function slideBack(yaw: number, distance: number): [number, number];
  export function chairComesHome(
    seat: { readonly x: number; readonly z: number },
    player: { readonly x: number; readonly z: number },
  ): boolean;
}

declare module '@netverse/game-assets/runtime/shop-sign.mjs' {
  import type { Group, MeshBasicMaterial, Object3D } from 'three';
  import type { Placement, ShopRecipe } from '@netverse/game-assets/runtime/shop-look.mjs';
  import type { ShopMaterials } from '@netverse/game-assets/runtime/three-shop.mjs';

  export interface SignStyle {
    text: string;
    kind: 'neon' | 'led' | 'painted';
    color: string;
    core: string;
  }

  export type SignGroup = Group & { userData: { text: MeshBasicMaterial } };

  export function contrastColor(recipe: ShopRecipe): string;
  export function signStyle(recipe: ShopRecipe): SignStyle;
  export function paintSign(canvas: HTMLCanvasElement, style: SignStyle): HTMLCanvasElement;
  export function signPlan(recipe: ShopRecipe): Placement[];
  export function buildSigns(
    THREE: typeof import('three'),
    kitScene: Object3D,
    recipe: ShopRecipe,
    materials: ShopMaterials,
    canvas: HTMLCanvasElement,
  ): SignGroup;
  export function repaintSigns(group: SignGroup, recipe: ShopRecipe): void;
  export function disposeSigns(group: SignGroup): void;
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

  export const BACKPACK_NODE: string;
  export function wearsBackpack(clip: string): boolean;
  export function createActorLook(
    THREE: typeof import('three'),
    options?: { createCanvas?: () => HTMLCanvasElement; toonGradient?: Texture | null },
  ): ActorLook;
}
