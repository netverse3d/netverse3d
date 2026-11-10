import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  doorwayCell,
  kitAnchors,
  paletteRows,
  roomPlan,
  shopPlan,
  type KitAnchors,
  type PaletteConfig,
  type ShopRecipe,
} from '@netverse/game-assets/runtime/shop-look.mjs';
import {
  buildShop,
  kitLightmap,
  shopMaterials,
  type ShopMaterials,
} from '@netverse/game-assets/runtime/three-shop.mjs';
import { collisionBoxes } from '@netverse/game-shared/collision';
import type { FloorBox } from '@netverse/game-shared/movement';
import { createControls } from '../game/controls.ts';
import { CELL_SIZE, shopOpenFloor, shopPerimeter } from '../game/shop-bounds.ts';
import { createWalk } from '../game/walk.ts';
import type { QualityLevel, SceneState, SceneStats } from '../state/shop-slice.ts';
import {
  FAR_FIELD_OF_VIEW,
  CORNER_VIEW_TURN,
  DEFAULT_ORBIT,
  cameraPose,
  clearEye,
  cutaways,
  eyeDistance,
  fieldOfView,
  turnOrbit,
  zoomOrbit,
} from './follow-camera.ts';
import { QUALITY_PRESETS, pixelRatioFor } from './quality.ts';
import { createPlayer, type Player, type Spawn } from './player.ts';

export interface ShopAssets {
  config: { palette: PaletteConfig };
  ids: string[];
  recipes: Record<string, ShopRecipe>;
  station: GLTF;
  room: GLTF;
  player: GLTF;
  anchors: KitAnchors;
  rows: string[];
}

export interface ShopScene {
  setRecipe(id: string): void;
  setQuality(level: QualityLevel): void;
  rendererName(): string;
  simulateContextLoss(): boolean;
  dispose(): void;
}

export interface ShopSceneOptions {
  canvas: HTMLCanvasElement;
  assets: ShopAssets;
  recipeId: string;
  quality: QualityLevel;
  onStats?: (stats: SceneStats) => void;
  onState?: (state: SceneState) => void;
  onError?: (message: string) => void;
}

interface LightPreset {
  sky: string;
  ground: string;
  ambient: number;
  points: [string, string];
  bloom: number;
  exposure: number;
}

const YAW = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 } as const;
const CONTEXT_RESTORE_DELAY = 400;
const STATS_INTERVAL = 0.5;
const ENVIRONMENT_BLUR = 0.04;
const LIGHTING: Record<ShopRecipe['lighting'], LightPreset> = {
  neon: {
    sky: '#4a36b8',
    ground: '#120c24',
    ambient: 0.5,
    points: ['#a66bff', '#5ce1ff'],
    bloom: 0.8,
    exposure: 1,
  },
  dim: {
    sky: '#1f3a44',
    ground: '#06100f',
    ambient: 0.35,
    points: ['#1ee8d2', '#0aa0ff'],
    bloom: 0.55,
    exposure: 0.9,
  },
  warm: {
    sky: '#ffb347',
    ground: '#1a110a',
    ambient: 0.7,
    points: ['#ff9f1c', '#ff6f3c'],
    bloom: 0.35,
    exposure: 1.05,
  },
  daylight: {
    sky: '#ffffff',
    ground: '#8899aa',
    ambient: 1.4,
    points: ['#ffffff', '#ffffff'],
    bloom: 0.12,
    exposure: 1.1,
  },
};

export async function loadShopAssets(base: string): Promise<ShopAssets> {
  const json = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${base}/${path}`);
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  const [config, ids] = await Promise.all([
    json<ShopAssets['config']>('assets.config.json'),
    json<string[]>('recipes/index.json'),
  ]);
  const recipes = Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await json<ShopRecipe>(`recipes/${id}.json`)] as const),
    ),
  );
  const loader = new GLTFLoader();
  const model = (file: string) => loader.loadAsync(`${base}/exported/${file}`);
  const [station, room, player] = await Promise.all([
    model('station-parts.glb'),
    model('room-kit.glb'),
    model('player.glb'),
  ]);
  return {
    config,
    ids,
    recipes,
    station,
    room,
    player,
    anchors: { ...kitAnchors(station.parser.json), ...kitAnchors(room.parser.json) },
    rows: paletteRows(config.palette),
  };
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) {
      (object as THREE.InstancedMesh).dispose();
    } else if ((object as THREE.Mesh).isMesh && !(object as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
  });
  group.clear();
}

function disposeMaterials(materials: ShopMaterials): void {
  materials.surface.map?.dispose();
  materials.surface.emissiveMap?.dispose();
  for (const material of [materials.surface, materials.glow, materials.display, materials.decal]) {
    material.dispose();
  }
}

function spawnFor(recipe: ShopRecipe): Spawn {
  const { cells, door } = recipe.layout;
  const [width, depth] = cells;
  const [cx, cz] = doorwayCell(door, cells);
  const yaw = YAW[door.wall] + Math.PI;
  const inward = Math.min(1, Math.max(width, depth) - 1);
  return {
    x: (cx - (width - 1) / 2) * CELL_SIZE + Math.sin(yaw) * inward * CELL_SIZE,
    z: (cz - (depth - 1) / 2) * CELL_SIZE + Math.cos(yaw) * inward * CELL_SIZE,
    yaw,
  };
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function createShopScene(options: ShopSceneOptions): ShopScene {
  const { canvas, assets } = options;
  const onStats = options.onStats ?? (() => {});
  const onState = options.onState ?? (() => {});
  const onError = options.onError ?? (() => {});
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0a18');
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(FAR_FIELD_OF_VIEW, 1, 0.1, 80);
  const cutPlanes = cutaways([0, 0, 0], { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }).map(
    ([x, y, z, constant]) => new THREE.Plane(new THREE.Vector3(x, y, z), constant),
  );
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.6, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const content = new THREE.Group();
  const lights = new THREE.Group();
  scene.add(content, lights);
  const clock = new THREE.Clock();
  const state: SceneState = {
    recipeId: options.recipeId,
    quality: options.quality,
    rebuilds: 0,
    frames: 0,
    restored: false,
    lost: false,
    ready: false,
    face: false,
  };
  let pmrem: THREE.PMREMGenerator | null = null;
  let materialSets: ShopMaterials[] = [];
  let player: Player | null = null;
  const controls = createControls(canvas, window);
  const walk = createWalk({ x: 0, z: 0, yaw: 0 }, []);
  let orbit = DEFAULT_ORBIT;
  let openFloor: FloorBox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let furniture: FloorBox[] = [];
  let frames = 0;
  let elapsed = 0;

  const emit = () => onState({ ...state });

  function buildEnvironment(): void {
    scene.environment?.dispose();
    pmrem?.dispose();
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), ENVIRONMENT_BLUR).texture;
  }

  function resize(): void {
    const host = canvas.parentElement ?? canvas;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function applyQuality(): void {
    const preset = QUALITY_PRESETS[state.quality];
    const ratio = pixelRatioFor(state.quality, window.devicePixelRatio);
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    scene.environmentIntensity = preset.environmentIntensity;
    bloom.enabled = preset.bloom;
    resize();
  }

  function relight(recipe: ShopRecipe): void {
    const preset = LIGHTING[recipe.lighting] ?? LIGHTING.neon;
    lights.clear();
    lights.add(new THREE.HemisphereLight(preset.sky, preset.ground, preset.ambient));
    const [width, depth] = recipe.layout.cells;
    preset.points.forEach((color, index) => {
      const light = new THREE.PointLight(color, 18, 12, 1.6);
      const side = index ? 1 : -1;
      light.position.set(side * (width - 0.5), 2.6, -side * (depth - 0.5));
      lights.add(light);
    });
    bloom.strength = preset.bloom;
    renderer.toneMappingExposure = preset.exposure;
  }

  function play(delta: number): void {
    if (!player) return;
    const turn = controls.takeTurn();
    orbit = zoomOrbit(turnOrbit(orbit, turn.right, turn.down), controls.takeZoom());
    const frame = walk.advance(delta, controls.intent(), orbit.yaw);
    player.moveTo(frame.player);
    player.playClip(frame.clip);
    const pose = cameraPose(frame.player, orbit);
    const eye = clearEye(pose, furniture);
    const lens = fieldOfView(eyeDistance(eye, pose.target));
    if (camera.fov !== lens) {
      camera.fov = lens;
      camera.updateProjectionMatrix();
    }
    camera.position.set(...eye);
    camera.lookAt(...pose.target);
    cutaways(eye, openFloor).forEach(([x, y, z, constant], index) => {
      cutPlanes[index]?.set(new THREE.Vector3(x, y, z), constant);
    });
  }

  function clearContent(): void {
    disposeGroup(content);
    player?.dispose();
    player = null;
    materialSets.forEach(disposeMaterials);
    materialSets = [];
  }

  function build(resume = false): void {
    clearContent();
    const recipe = assets.recipes[state.recipeId];
    if (!recipe) throw new Error(`unknown recipe ${state.recipeId}`);
    const dress = (kit: GLTF): ShopMaterials => {
      const materials = shopMaterials(THREE, recipe, assets.rows, {
        lightmap: kitLightmap(kit.scene),
      });
      for (const material of Object.values(materials)) material.clippingPlanes = cutPlanes;
      materialSets.push(materials);
      return materials;
    };
    const room = roomPlan(recipe);
    const stations = shopPlan(recipe, assets.anchors);
    const stationBoxes = collisionBoxes(stations, assets.anchors);
    const obstacles = [
      ...collisionBoxes(room, assets.anchors),
      ...stationBoxes,
      ...shopPerimeter(recipe.layout.cells),
    ];
    const spawn = resume ? walk.position() : spawnFor(recipe);
    content.add(buildShop(THREE, assets.room.scene, room, dress(assets.room)));
    content.add(buildShop(THREE, assets.station.scene, stations, dress(assets.station)));
    player = createPlayer(THREE, assets.player, spawn);
    content.add(player.root);
    walk.place(spawn, obstacles);
    furniture = stationBoxes;
    openFloor = shopOpenFloor(recipe.layout.cells);
    if (!resume) orbit = { ...DEFAULT_ORBIT, yaw: spawn.yaw + CORNER_VIEW_TURN };
    relight(recipe);
    play(0);
    state.rebuilds += 1;
    state.frames = 0;
    state.ready = true;
    state.face = player.hasFace;
    emit();
  }

  function rebuild(resume = false): void {
    try {
      build(resume);
    } catch (reason) {
      clearContent();
      state.ready = false;
      emit();
      onError(describe(reason));
    }
  }

  function tick(): void {
    if (state.lost || renderer.getContext().isContextLost()) return;
    const delta = clock.getDelta();
    play(delta);
    player?.update(delta);
    renderer.info.reset();
    composer.render();
    frames += 1;
    elapsed += delta;
    state.frames += 1;
    if (state.frames === 1) emit();
    if (elapsed >= STATS_INTERVAL) {
      onStats({
        fps: Math.round(frames / elapsed),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      frames = 0;
      elapsed = 0;
    }
  }

  const onContextLost = (event: Event) => {
    event.preventDefault();
    state.lost = true;
    state.ready = false;
    clearContent();
    scene.environment?.dispose();
    scene.environment = null;
    pmrem?.dispose();
    pmrem = null;
    emit();
  };
  const onContextRestored = () => {
    state.lost = false;
    state.restored = true;
    buildEnvironment();
    resize();
    controls.takeTurn();
    controls.takeZoom();
    rebuild(true);
    renderer.setAnimationLoop(tick);
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement ?? canvas);

  function dispose(): void {
    renderer.setAnimationLoop(null);
    controls.dispose();
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    clearContent();
    scene.environment?.dispose();
    pmrem?.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  try {
    buildEnvironment();
    applyQuality();
    build();
  } catch (reason) {
    dispose();
    throw reason;
  }

  renderer.setAnimationLoop(tick);

  return {
    setRecipe(id) {
      if (!assets.recipes[id]) return;
      state.recipeId = id;
      rebuild();
    },
    setQuality(level) {
      state.quality = level;
      applyQuality();
      emit();
    },
    rendererName() {
      const gl = renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return String(
        info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      );
    },
    simulateContextLoss() {
      const extension = renderer.getContext().getExtension('WEBGL_lose_context');
      if (!extension) return false;
      extension.loseContext();
      setTimeout(() => extension.restoreContext(), CONTEXT_RESTORE_DELAY);
      return true;
    },
    dispose,
  };
}
