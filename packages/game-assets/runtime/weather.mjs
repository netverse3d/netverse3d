export const WEATHER_STATES = {
  clear: {
    id: 'clear',
    name: 'Tạnh',
    rainCount: 0,
    rainSpeed: 0,
    windAngle: 0,
    wetness: 0.0,
    fog: {
      color: '#24193d',
      near: 16,
      far: 90,
      density: 0.018,
    },
    exposure: 1.0,
    environmentIntensity: 0.45,
    droplets: 0.0,
  },
  lightRain: {
    id: 'lightRain',
    name: 'Mưa nhẹ',
    rainCount: 600,
    rainSpeed: 14.0,
    windAngle: 0.12,
    wetness: 0.65,
    fog: {
      color: '#201636',
      near: 12,
      far: 75,
      density: 0.024,
    },
    exposure: 0.95,
    environmentIntensity: 0.4,
    droplets: 0.5,
  },
  heavyRain: {
    id: 'heavyRain',
    name: 'Mưa lớn',
    rainCount: 1800,
    rainSpeed: 22.0,
    windAngle: 0.28,
    wetness: 1.0,
    fog: {
      color: '#1a122c',
      near: 8,
      far: 55,
      density: 0.035,
    },
    exposure: 0.88,
    environmentIntensity: 0.35,
    droplets: 1.0,
  },
  denseFog: {
    id: 'denseFog',
    name: 'Sương dày',
    rainCount: 0,
    rainSpeed: 0,
    windAngle: 0,
    wetness: 0.25,
    fog: {
      color: '#281c44',
      near: 4,
      far: 35,
      density: 0.045,
    },
    exposure: 0.92,
    environmentIntensity: 0.32,
    droplets: 0.2,
  },
};

export const WEATHER_CONFIG = {
  cycleDuration: 180,
  transitionDuration: 30,
  dryingDuration: 90,
  defaultSeed: 'netverse-saigon',
};

export const TRANSITION_PROBABILITIES = {
  clear: [
    { to: 'lightRain', weight: 0.5 },
    { to: 'denseFog', weight: 0.3 },
    { to: 'clear', weight: 0.2 },
  ],
  lightRain: [
    { to: 'heavyRain', weight: 0.4 },
    { to: 'clear', weight: 0.3 },
    { to: 'lightRain', weight: 0.2 },
    { to: 'denseFog', weight: 0.1 },
  ],
  heavyRain: [
    { to: 'lightRain', weight: 0.6 },
    { to: 'denseFog', weight: 0.3 },
    { to: 'heavyRain', weight: 0.1 },
  ],
  denseFog: [
    { to: 'clear', weight: 0.5 },
    { to: 'lightRain', weight: 0.3 },
    { to: 'denseFog', weight: 0.2 },
  ],
};

export function hashSeed(seed, index = 0) {
  const str = `${seed}:${index}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

export function pickNextWeather(currentStateId, rand) {
  const transitions = TRANSITION_PROBABILITIES[currentStateId] ?? TRANSITION_PROBABILITIES.clear;
  let acc = 0;
  for (const item of transitions) {
    acc += item.weight;
    if (rand < acc) return item.to;
  }
  return transitions[transitions.length - 1].to;
}

export function getWeatherSequence(seed, count, initial = 'clear') {
  const sequence = [initial];
  let current = initial;
  for (let i = 1; i < count; i += 1) {
    const rand = hashSeed(seed, i);
    current = pickNextWeather(current, rand);
    sequence.push(current);
  }
  return sequence;
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function lerpColor(c1, c2, t) {
  const parseHex = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  const r = Math.round(lerp(r1, r2, t))
    .toString(16)
    .padStart(2, '0');
  const g = Math.round(lerp(g1, g2, t))
    .toString(16)
    .padStart(2, '0');
  const b = Math.round(lerp(b1, b2, t))
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

export function interpolateWeather(from, to, factor, dryingFactor = factor) {
  const t = Math.min(Math.max(factor, 0), 1);
  const dt = Math.min(Math.max(dryingFactor, 0), 1);
  const wetnessT = to.wetness < from.wetness ? dt : t;

  return {
    id: t >= 0.5 ? to.id : from.id,
    name: t >= 0.5 ? to.name : from.name,
    rainCount: Math.round(lerp(from.rainCount, to.rainCount, t)),
    rainSpeed: lerp(from.rainSpeed, to.rainSpeed, t),
    windAngle: lerp(from.windAngle, to.windAngle, t),
    wetness: lerp(from.wetness, to.wetness, wetnessT),
    fog: {
      color: lerpColor(from.fog.color, to.fog.color, t),
      near: lerp(from.fog.near, to.fog.near, t),
      far: lerp(from.fog.far, to.fog.far, t),
      density: lerp(from.fog.density, to.fog.density, t),
    },
    exposure: lerp(from.exposure, to.exposure, t),
    environmentIntensity: lerp(from.environmentIntensity, to.environmentIntensity, t),
    droplets: lerp(from.droplets, to.droplets, t),
  };
}

export function getWeatherAtTime(options = {}) {
  const seed = options.seed ?? WEATHER_CONFIG.defaultSeed;
  const cycleDuration = options.cycleDuration ?? WEATHER_CONFIG.cycleDuration;
  const transitionDuration = options.transitionDuration ?? WEATHER_CONFIG.transitionDuration;
  const dryingDuration = options.dryingDuration ?? WEATHER_CONFIG.dryingDuration;

  let from = options.fromState;
  let to = options.toState;
  let timeInCycle = options.timeIntoCycle;

  if (!from || !to) {
    const time = options.time ?? 0;
    const cycleIndex = Math.floor(time / cycleDuration);
    timeInCycle = time % cycleDuration;
    const seq = getWeatherSequence(seed, cycleIndex + 2);
    from = WEATHER_STATES[seq[cycleIndex]] ?? WEATHER_STATES.clear;
    to = WEATHER_STATES[seq[cycleIndex + 1]] ?? WEATHER_STATES.clear;
  }

  const factor = Math.min(1, timeInCycle / transitionDuration);
  const dryingFactor = Math.min(1, timeInCycle / dryingDuration);
  return interpolateWeather(from, to, factor, dryingFactor);
}

export function calculateRoadRoughness(baseRoughness, wetness) {
  return Number(lerp(baseRoughness, 0.15, wetness).toFixed(4));
}

export function applyQualityLevel(state, quality = 'high') {
  if (quality === 'low') {
    return {
      ...state,
      rainCount: 0,
      droplets: 0,
    };
  }
  if (quality === 'medium') {
    return {
      ...state,
      rainCount: Math.round(state.rainCount * 0.5),
      droplets: state.droplets * 0.7,
    };
  }
  return { ...state };
}

export function createRainSystem(THREE, options = {}) {
  const maxDrops = options.maxDrops ?? 2000;
  const areaSize = options.areaSize ?? [30, 20, 30];
  const dropLength = options.dropLength ?? 0.45;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(maxDrops * 6);
  const velocities = new Float32Array(maxDrops);

  for (let i = 0; i < maxDrops; i += 1) {
    const x = (Math.random() - 0.5) * areaSize[0];
    const y = (Math.random() - 0.5) * areaSize[1];
    const z = (Math.random() - 0.5) * areaSize[2];
    velocities[i] = 0.8 + Math.random() * 0.4;
    const idx = i * 6;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    positions[idx + 3] = x;
    positions[idx + 4] = y - dropLength;
    positions[idx + 5] = z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xa0c4ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;

  function update(camera, delta, weather) {
    if (!weather || weather.rainCount <= 0) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const activeDrops = Math.min(maxDrops, weather.rainCount);
    geometry.setDrawRange(0, activeDrops * 2);

    const pos = geometry.attributes.position.array;
    const speed = weather.rainSpeed || 15;
    const tilt = weather.windAngle || 0;
    const halfY = areaSize[1] / 2;
    const halfX = areaSize[0] / 2;
    const halfZ = areaSize[2] / 2;
    const camY = camera.position.y;
    const camX = camera.position.x;
    const camZ = camera.position.z;

    for (let i = 0; i < activeDrops; i += 1) {
      const idx = i * 6;
      const v = speed * velocities[i] * delta;
      let y = pos[idx + 1] - v;
      let x = pos[idx] + v * tilt;
      let z = pos[idx + 2] + v * (tilt * 0.4);

      if (y < camY - halfY) y += areaSize[1];
      if (x < camX - halfX) x += areaSize[0];
      if (x > camX + halfX) x -= areaSize[0];
      if (z < camZ - halfZ) z += areaSize[2];
      if (z > camZ + halfZ) z -= areaSize[2];

      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;
      pos[idx + 3] = x + tilt * dropLength;
      pos[idx + 4] = y - dropLength;
      pos[idx + 5] = z + tilt * 0.4 * dropLength;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { mesh, update, geometry, material };
}
