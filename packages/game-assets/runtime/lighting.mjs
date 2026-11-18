export const STANDARD_BLOOM = {
  strength: 0.35,
  radius: 0.4,
  threshold: 0.85,
};

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
