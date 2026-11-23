import { calculateRoadRoughness } from './weather.mjs';

export const STANDARD_BLOOM = {
  strength: 0.35,
  radius: 0.4,
  threshold: 0.85,
};

export const NIGHT_SKY = {
  zenith: '#080614',
  mid: '#140f2d',
  horizon: '#24193d',
  glow: '#342258',
  nadir: '#0c0a18',
};

export const OUTDOOR_LIGHTING = {
  sky: NIGHT_SKY,
  fog: {
    color: NIGHT_SKY.horizon,
    near: 16,
    far: 90,
    density: 0.018,
  },
  hemisphere: {
    sky: '#3c2e74',
    ground: '#120c24',
    intensity: 0.85,
  },
  moon: {
    color: '#9fb4ff',
    intensity: 1.1,
    position: [10, 20, 8],
  },
  exposure: 1.0,
  bloom: {
    strength: STANDARD_BLOOM.strength,
    radius: STANDARD_BLOOM.radius,
    threshold: STANDARD_BLOOM.threshold,
  },
  environmentIntensity: 0.45,
};

const SHOP_LIGHTING = {
  neon: {
    sky: '#4a36b8',
    ground: '#120c24',
    ambient: 0.5,
    points: ['#a66bff', '#5ce1ff'],
    point: 7,
    bloom: 0.35,
    exposure: 1.0,
  },
  dim: {
    sky: '#1f3a44',
    ground: '#06100f',
    ambient: 0.3,
    points: ['#1ee8d2', '#0aa0ff'],
    point: 5,
    bloom: 0.3,
    exposure: 0.9,
  },
  warm: {
    sky: '#ffb347',
    ground: '#1a110a',
    ambient: 0.6,
    points: ['#ff9f1c', '#ff6f3c'],
    point: 7,
    bloom: 0.15,
    exposure: 1.0,
  },
  daylight: {
    sky: '#ffffff',
    ground: '#8899aa',
    ambient: 1.2,
    points: ['#ffffff', '#ffffff'],
    point: 3,
    bloom: 0.05,
    exposure: 1.05,
  },
};

function shopPreset(name, values) {
  return {
    id: `shop-${name}`,
    kind: 'indoor',
    toneMapping: 'aces',
    exposure: values.exposure,
    background: '#0d0a18',
    environment: { source: 'room', intensity: 0.3, blur: 0.04 },
    fog: null,
    hemisphere: {
      sky: values.sky,
      ground: values.ground,
      intensity: values.ambient,
    },
    directional: [],
    points: values.points.map((color) => ({
      color,
      intensity: values.point,
      distance: 12,
      decay: 1.6,
      placement: 'room-corners',
    })),
    bloom: {
      strength: values.bloom,
      radius: STANDARD_BLOOM.radius,
      threshold: STANDARD_BLOOM.threshold,
    },
  };
}

export const LIGHTING_PRESETS = {
  studio: {
    id: 'studio',
    kind: 'studio',
    toneMapping: 'aces',
    exposure: 1.0,
    background: '#141026',
    environment: { source: 'room', intensity: 0.8, blur: 0.04 },
    fog: null,
    hemisphere: { sky: '#ffffff', ground: '#2a2a33', intensity: 0.7 },
    directional: [
      { color: '#fff4e6', intensity: 1.2, position: [3, 5, 4] },
      { color: '#dbe6ff', intensity: 0.8, position: [-4, 2.5, 2] },
      { color: '#ffffff', intensity: 0.9, position: [-1, 3.5, -5] },
    ],
    points: [],
    bloom: { ...STANDARD_BLOOM },
  },
  ...Object.fromEntries(
    Object.entries(SHOP_LIGHTING).map(([name, values]) => [
      `shop-${name}`,
      shopPreset(name, values),
    ]),
  ),
  'street-night': {
    id: 'street-night',
    kind: 'outdoor',
    toneMapping: 'aces',
    exposure: OUTDOOR_LIGHTING.exposure,
    background: 'night-sky',
    environment: { source: 'night-sky', intensity: OUTDOOR_LIGHTING.environmentIntensity, blur: 0 },
    fog: {
      color: OUTDOOR_LIGHTING.fog.color,
      near: OUTDOOR_LIGHTING.fog.near,
      far: OUTDOOR_LIGHTING.fog.far,
    },
    hemisphere: { ...OUTDOOR_LIGHTING.hemisphere },
    directional: [
      {
        color: OUTDOOR_LIGHTING.moon.color,
        intensity: OUTDOOR_LIGHTING.moon.intensity,
        position: [...OUTDOOR_LIGHTING.moon.position],
      },
    ],
    points: [],
    bloom: { ...OUTDOOR_LIGHTING.bloom },
  },
  'showcase-baked': {
    id: 'showcase-baked',
    kind: 'baked',
    toneMapping: 'aces',
    exposure: 1.0,
    background: '#080614',
    environment: { source: 'none', intensity: 0, blur: 0 },
    fog: null,
    hemisphere: null,
    directional: [],
    points: [],
    bloom: { strength: 0.2, radius: 0.4, threshold: STANDARD_BLOOM.threshold },
  },
};

const SHOP_PRESET_IDS = {
  neon: 'shop-neon',
  dim: 'shop-dim',
  warm: 'shop-warm',
  daylight: 'shop-daylight',
};

export function lightingFor(name) {
  const id = SHOP_PRESET_IDS[name] ?? name;
  const preset = LIGHTING_PRESETS[id];
  if (!preset) throw new RangeError(`unknown lighting preset: ${name}`);
  return preset;
}

export function createBloomPass(THREE, BloomPass, presetName = 'shop-neon') {
  if (typeof BloomPass !== 'function') throw new TypeError('BloomPass constructor is required');
  if (!THREE.Vector2) throw new TypeError('THREE.Vector2 is required to create a bloom pass');
  const bloom = lightingFor(presetName).bloom;
  return new BloomPass(new THREE.Vector2(1, 1), bloom.strength, bloom.radius, bloom.threshold);
}

function mergeLightingConfig(base, patch) {
  const result = { ...base, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = { ...base[key], ...value };
    }
  }
  return result;
}

function presetAfterUpdate(current, next) {
  if (typeof next === 'string') return lightingFor(next);
  if (!next || typeof next !== 'object')
    throw new TypeError('lighting update must be a preset or object');
  const base = next.id && LIGHTING_PRESETS[next.id] ? LIGHTING_PRESETS[next.id] : current;
  return mergeLightingConfig(base, next);
}

export function nightSkyGradientStops(sky = NIGHT_SKY) {
  return [
    { offset: 0.0, color: sky.zenith },
    { offset: 0.32, color: sky.mid },
    { offset: 0.46, color: sky.glow },
    { offset: 0.5, color: sky.horizon },
    { offset: 0.58, color: sky.nadir },
    { offset: 1.0, color: sky.nadir },
  ];
}

export function renderNightSkyCanvas(canvas, sky = NIGHT_SKY) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const { offset, color } of nightSkyGradientStops(sky)) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function createNightSkyTexture(THREE, options = {}) {
  const width = options.width ?? 512;
  const height = options.height ?? 256;
  const canvas =
    options.canvas ??
    (typeof globalThis.document !== 'undefined'
      ? globalThis.document.createElement('canvas')
      : null);
  if (!canvas) throw new Error('canvas is required to create sky texture');
  canvas.width = width;
  canvas.height = height;
  renderNightSkyCanvas(canvas, options.sky ?? NIGHT_SKY);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function applyLighting(THREE, options) {
  const { scene, renderer, bloomPass, room, RoomEnvironment } = options;
  if (!scene) throw new TypeError('scene is required to apply lighting');
  let activePreset = presetAfterUpdate({}, options.preset);
  const lights = [];
  let pmrem = options.pmrem ?? null;
  const ownsPmrem = !options.pmrem;
  const sharedEnvironment = options.environmentTexture ?? null;
  let ownsSkyTexture = !options.skyTexture;
  let environmentTarget = null;
  let skyTexture = null;
  let backgroundColor = null;
  let backgroundValue = null;
  let fog = null;
  let fogKey = null;
  let environmentKey = null;
  let lightsKey = null;
  let disposed = false;

  function ensurePmrem() {
    if (!pmrem && THREE.PMREMGenerator) pmrem = new THREE.PMREMGenerator(renderer);
    return pmrem;
  }

  function removeEnvironment() {
    const texture = environmentTarget?.texture;
    if (scene.environment === texture || scene.environment === sharedEnvironment)
      scene.environment = null;
    environmentTarget?.dispose?.();
    environmentTarget = null;
    environmentKey = null;
  }

  function releaseSkyTexture() {
    if (scene.background === skyTexture) scene.background = null;
    if (ownsSkyTexture) skyTexture?.dispose?.();
    skyTexture = null;
    ownsSkyTexture = true;
  }

  function setBackground() {
    if (activePreset.background === 'night-sky') {
      if (!skyTexture) {
        skyTexture = options.skyTexture ?? createNightSkyTexture(THREE, options);
        ownsSkyTexture = !options.skyTexture;
      }
      scene.background = skyTexture;
      backgroundColor = null;
      backgroundValue = 'night-sky';
      return;
    }
    if (backgroundValue === activePreset.background && backgroundColor) {
      scene.background = backgroundColor;
      return;
    }
    releaseSkyTexture();
    backgroundColor = THREE.Color
      ? new THREE.Color(activePreset.background)
      : activePreset.background;
    scene.background = backgroundColor;
    backgroundValue = activePreset.background;
  }

  function setEnvironment() {
    const environment = activePreset.environment;
    const source = environment?.source ?? 'none';
    scene.environmentIntensity = environment?.intensity ?? 0;
    if (source === 'none') {
      removeEnvironment();
      scene.environment = null;
      if (activePreset.background !== 'night-sky') releaseSkyTexture();
      return;
    }
    const key = `${source}:${environment.blur ?? 0}`;
    if (environmentKey === key) return;
    removeEnvironment();
    if (source === 'room' && sharedEnvironment) {
      scene.environment = sharedEnvironment;
      environmentKey = key;
      return;
    }
    const generator = ensurePmrem();
    if (source === 'night-sky' && generator?.fromEquirectangular) {
      const texture = skyTexture ?? options.skyTexture ?? createNightSkyTexture(THREE, options);
      ownsSkyTexture = !options.skyTexture;
      skyTexture = texture;
      environmentTarget = generator.fromEquirectangular(texture);
    } else if (source === 'room' && RoomEnvironment && generator?.fromScene) {
      const roomScene = new RoomEnvironment();
      environmentTarget = generator.fromScene(roomScene, environment.blur ?? 0);
      roomScene.dispose?.();
    }
    if (environmentTarget) scene.environment = environmentTarget.texture;
    else scene.environment = null;
    environmentKey = key;
  }

  function applyRenderer() {
    if (!renderer) return;
    renderer.toneMapping = THREE.ACESFilmicToneMapping ?? 'ACESFilmicToneMapping';
    if (options.setExposure !== false) renderer.toneMappingExposure = activePreset.exposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  function applyBloom() {
    if (!bloomPass || !activePreset.bloom) return;
    bloomPass.strength = activePreset.bloom.strength;
    bloomPass.radius = activePreset.bloom.radius;
    bloomPass.threshold = activePreset.bloom.threshold;
  }

  function positionFor(light, index) {
    if (light.placement === 'room-corners') {
      const width = room?.width ?? 1;
      const depth = room?.depth ?? 1;
      const side = index ? 1 : -1;
      return [side * (width - 0.5), 2.6, -side * (depth - 0.5)];
    }
    return light.position ?? [0, 0, 0];
  }

  function addLight(light) {
    scene.add(light);
    lights.push(light);
  }

  function setLights() {
    const nextKey = JSON.stringify([
      options.addLights !== false,
      room?.width,
      room?.depth,
      activePreset.hemisphere,
      activePreset.directional,
      activePreset.points,
    ]);
    if (lightsKey === nextKey) return;
    for (const light of lights) scene.remove?.(light);
    lights.length = 0;
    lightsKey = nextKey;
    if (options.addLights === false) return;
    if (activePreset.hemisphere) {
      addLight(
        new THREE.HemisphereLight(
          activePreset.hemisphere.sky,
          activePreset.hemisphere.ground,
          activePreset.hemisphere.intensity,
        ),
      );
    }
    for (const [index, spec] of activePreset.directional.entries()) {
      const light = new THREE.DirectionalLight(spec.color, spec.intensity);
      light.position.set(...positionFor(spec, index));
      addLight(light);
    }
    for (const [index, spec] of activePreset.points.entries()) {
      const light = new THREE.PointLight(spec.color, spec.intensity, spec.distance, spec.decay);
      light.position.set(...positionFor(spec, index));
      addLight(light);
    }
  }

  function setFog() {
    const nextFog = activePreset.fog;
    const nextKey = nextFog ? JSON.stringify(nextFog) : 'none';
    if (fogKey === nextKey && scene.fog === fog) return;
    if (!nextFog) {
      scene.fog = null;
      fog = null;
      fogKey = nextKey;
      return;
    }
    if (fog && typeof fog.color?.set === 'function') {
      fog.color.set(nextFog.color);
      fog.near = nextFog.near;
      fog.far = nextFog.far;
    } else {
      fog = new THREE.Fog(nextFog.color, nextFog.near, nextFog.far);
    }
    scene.fog = fog;
    fogKey = nextKey;
  }

  function applyPreset() {
    if (disposed) throw new Error('lighting handle has been disposed');
    setBackground();
    setFog();
    setEnvironment();
    applyRenderer();
    applyBloom();
    setLights();
  }

  const handle = {
    get preset() {
      return activePreset;
    },
    get lights() {
      return lights;
    },
    get pmrem() {
      return pmrem;
    },
    get skyTexture() {
      return skyTexture;
    },
    get envTexture() {
      return environmentTarget?.texture ?? sharedEnvironment;
    },
    update(next) {
      activePreset = presetAfterUpdate(activePreset, next);
      applyPreset();
      return handle;
    },
    setExposure(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new TypeError('exposure must be a finite number');
      }
      activePreset = mergeLightingConfig(activePreset, { exposure: value });
      applyRenderer();
      return handle;
    },
    dispose() {
      if (disposed) return;
      for (const light of lights) scene.remove?.(light);
      lights.length = 0;
      lightsKey = null;
      if (scene.background === skyTexture || scene.background === backgroundColor)
        scene.background = null;
      if (scene.fog === fog) scene.fog = null;
      if (
        scene.environment === environmentTarget?.texture ||
        scene.environment === sharedEnvironment
      )
        scene.environment = null;
      environmentTarget?.dispose?.();
      environmentTarget = null;
      if (ownsSkyTexture) skyTexture?.dispose?.();
      skyTexture = null;
      if (ownsPmrem) pmrem?.dispose?.();
      disposed = true;
    },
  };

  applyPreset();
  return handle;
}

export function setupOutdoorEnvironment(THREE, scene, renderer, options = {}) {
  const lighting = options.lighting ?? OUTDOOR_LIGHTING;
  const preset = {
    ...lightingFor('street-night'),
    exposure: lighting.exposure,
    environment: {
      ...lightingFor('street-night').environment,
      intensity: lighting.environmentIntensity,
    },
    fog: lighting.fog,
    hemisphere: lighting.hemisphere,
    directional: [
      {
        color: lighting.moon.color,
        intensity: lighting.moon.intensity,
        position: lighting.moon.position,
      },
    ],
    bloom: lighting.bloom ?? lightingFor('street-night').bloom,
  };
  const handle = applyLighting(THREE, {
    scene,
    renderer,
    preset,
    skyTexture: options.skyTexture,
    canvas: options.canvas,
    pmrem: options.pmrem,
    addLights: options.addLights,
    setExposure: options.setExposure,
  });
  const result = {
    get preset() {
      return handle.preset;
    },
    get lights() {
      return handle.lights;
    },
    get pmrem() {
      return handle.pmrem;
    },
    get skyTexture() {
      return handle.skyTexture;
    },
    get envTexture() {
      return handle.envTexture;
    },
    get hemisphere() {
      return handle.lights.find((light) => light instanceof THREE.HemisphereLight) ?? null;
    },
    get moon() {
      return handle.lights.find((light) => light instanceof THREE.DirectionalLight) ?? null;
    },
    update(next) {
      return handle.update(next);
    },
    setExposure(value) {
      return handle.setExposure(value);
    },
    dispose() {
      handle.dispose();
    },
    handle,
  };
  return result;
}

export function applyWeatherToOutdoor(handle, weather, options = {}) {
  if (!weather || !handle?.update) return;
  const change = {};
  if (weather.fog) change.fog = weather.fog;
  if (typeof weather.environmentIntensity === 'number') {
    change.environment = { intensity: weather.environmentIntensity };
  }
  if (typeof weather.exposure === 'number') change.exposure = weather.exposure;
  if (Object.keys(change).length) handle.update(change);
  if (options.materials?.surface && typeof weather.wetness === 'number') {
    const base = options.baseRoughness ?? 0.85;
    options.materials.surface.roughness = calculateRoadRoughness(base, weather.wetness);
  }
}

export const EMISSIVE_SCALE = {
  neon: { min: 1.8, max: 2.8, default: 2.2 },
  screen: { min: 0.8, max: 1.4, default: 1.0 },
  streetLamp: { min: 2.5, max: 3.5, default: 3.0 },
  trafficSignal: { min: 2.0, max: 3.0, default: 2.5 },
  window: { min: 0.6, max: 1.3, default: 0.9 },
  vehicleHeadlight: { min: 3.0, max: 4.5, default: 3.6 },
  vehicleTaillight: { min: 1.5, max: 2.5, default: 2.0 },
};

export const LIGHT_BUDGET = {
  maxDynamicLightsPerBlock: 6,
  bakeBouncedLight: true,
};

export function isWithinEmissiveScale(type, value) {
  const scale = EMISSIVE_SCALE[type];
  if (!scale || typeof value !== 'number') return false;
  return value >= scale.min && value <= scale.max;
}

export function clampEmissiveIntensity(type, value) {
  const scale = EMISSIVE_SCALE[type];
  if (!scale) return typeof value === 'number' ? value : 1.0;
  if (typeof value !== 'number') return scale.default;
  return Math.min(Math.max(value, scale.min), scale.max);
}
