import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type QualityLevel = 'low' | 'medium' | 'high';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export function isQualityLevel(value: unknown): value is QualityLevel {
  return typeof value === 'string' && (QUALITY_LEVELS as readonly string[]).includes(value);
}

export interface SceneStats {
  fps: number;
  calls: number;
  triangles: number;
}

export interface SceneState {
  recipeId: string;
  quality: QualityLevel;
  rebuilds: number;
  frames: number;
  restored: boolean;
  lost: boolean;
  ready: boolean;
  face: boolean;
}

export interface RecipeOption {
  id: string;
  name: string;
}

export interface ShopState {
  stats: SceneStats;
  scene: SceneState;
  recipes: RecipeOption[];
  error: string | null;
  nearbySeat: string | null;
}

export const DEFAULT_RECIPE = 'tim-neon';

export function initialShopState(recipeId = DEFAULT_RECIPE): ShopState {
  return {
    stats: { fps: 0, calls: 0, triangles: 0 },
    scene: {
      recipeId,
      quality: 'medium',
      rebuilds: 0,
      frames: 0,
      restored: false,
      lost: false,
      ready: false,
      face: false,
    },
    recipes: [],
    error: null,
    nearbySeat: null,
  };
}

export const shopSlice = createSlice({
  name: 'shop',
  initialState: initialShopState(),
  reducers: {
    statsReported(state, action: PayloadAction<SceneStats>) {
      state.stats = action.payload;
    },
    sceneChanged(state, action: PayloadAction<SceneState>) {
      state.scene = action.payload;
    },
    recipesLoaded(state, action: PayloadAction<RecipeOption[]>) {
      state.recipes = action.payload;
    },
    errorRaised(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    nearbySeatChanged(state, action: PayloadAction<string | null>) {
      state.nearbySeat = action.payload;
    },
    seatRequested: {
      reducer() {},
      prepare: (seatId: string) => ({ payload: seatId }),
    },
    recipeRequested: {
      reducer() {},
      prepare: (id: string) => ({ payload: id }),
    },
    qualityRequested: {
      reducer() {},
      prepare: (level: QualityLevel) => ({ payload: level }),
    },
  },
});

export const {
  statsReported,
  sceneChanged,
  recipesLoaded,
  errorRaised,
  nearbySeatChanged,
  seatRequested,
  recipeRequested,
  qualityRequested,
} = shopSlice.actions;
