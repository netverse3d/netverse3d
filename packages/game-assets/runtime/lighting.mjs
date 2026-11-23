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
