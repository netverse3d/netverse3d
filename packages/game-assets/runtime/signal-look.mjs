import { EMISSIVE_SCALE } from './lighting.mjs';

const VEHICLE_COLORS = { red: '#ff2a2a', yellow: '#ffb52a', green: '#26ef65' };
const STREET_LAMP_COLOR = '#ffe2b8';
const OFF_LEVEL = 0.08;
const COUNTDOWN = 'signal_a_countdown';
const COUNTDOWN_CANVAS = { width: 112, height: 160 };

const BULBS = {
  signal_a_bulb_red: { color: VEHICLE_COLORS.red, phase: 'red', kind: 'vehicle' },
  signal_a_bulb_yellow: { color: VEHICLE_COLORS.yellow, phase: 'yellow', kind: 'vehicle' },
  signal_a_bulb_green: { color: VEHICLE_COLORS.green, phase: 'green', kind: 'vehicle' },
  [COUNTDOWN]: { color: VEHICLE_COLORS.yellow, phase: 'countdown', kind: 'vehicle' },
  walk_a_stop: { color: VEHICLE_COLORS.red, phase: 'stop', kind: 'pedestrian' },
  walk_a_go: { color: VEHICLE_COLORS.green, phase: 'go', kind: 'pedestrian' },
};

export const SIGNAL_BULB_NAMES = Object.keys(BULBS);
export const STREET_LAMP_LED_NAMES = ['streetlight_a_led', 'streetlight_b_led'];

export const SEGMENT_RECTS = {
  a: [1, 0, 4, 1],
  b: [5, 1, 1, 3.5],
  c: [5, 5.5, 1, 3.5],
  d: [1, 9, 4, 1],
  e: [0, 5.5, 1, 3.5],
  f: [0, 1, 1, 3.5],
  g: [1, 4.5, 4, 1],
};

export const DIGIT_SEGMENTS = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
};

export const COUNTDOWN_LAYOUT = { cells: 2, digitWidth: 6, digitHeight: 10, gap: 2, margin: 1.5 };

export function countdownDigits(remaining) {
  if (!(remaining > 0)) return '';
  return String(Math.min(99, Math.ceil(remaining)));
}

export function countdownSegmentRects(text, width, height) {
  const { cells, digitWidth, digitHeight, gap, margin } = COUNTDOWN_LAYOUT;
  const unitsWide = margin * 2 + digitWidth * cells + gap * (cells - 1);
  const unitsHigh = margin * 2 + digitHeight;
  const scale = Math.min(width / unitsWide, height / unitsHigh);
  const left = (width - (unitsWide - margin * 2) * scale) / 2;
  const top = (height - digitHeight * scale) / 2;
  const firstCell = cells - text.length;
  return [...text].flatMap((digit, index) => {
    const cellLeft = left + (firstCell + index) * (digitWidth + gap) * scale;
    return [...(DIGIT_SEGMENTS[digit] ?? '')].map((segment) => {
      const [x, y, w, h] = SEGMENT_RECTS[segment];
      return [cellLeft + x * scale, top + y * scale, w * scale, h * scale];
    });
  });
}

export function paintCountdown(context, text, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  for (const rect of countdownSegmentRects(text, width, height)) context.fillRect(...rect);
}

export function signalBulbStyle(name, state) {
  const bulb = BULBS[name];
  if (!bulb) return null;
  const on = EMISSIVE_SCALE.trafficSignal.default;
  if (bulb.phase === 'countdown') {
    const digits = countdownDigits(state.remaining);
    const color = VEHICLE_COLORS[state.vehicle] ?? bulb.color;
    return { color, intensity: digits ? on : on * OFF_LEVEL, digits };
  }
  return { color: bulb.color, intensity: state[bulb.kind] === bulb.phase ? on : on * OFF_LEVEL };
}

export function streetLampStyle(name) {
  return STREET_LAMP_LED_NAMES.includes(name)
    ? { color: STREET_LAMP_COLOR, intensity: EMISSIVE_SCALE.streetLamp.default }
    : null;
}

function countdownDisplay(THREE, object, createCanvas) {
  const canvas = createCanvas();
  canvas.width = COUNTDOWN_CANVAS.width;
  canvas.height = COUNTDOWN_CANVAS.height;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  object.geometry.computeBoundingBox();
  const bounds = object.geometry.boundingBox;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 0.92, size.y * 0.92),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  plane.name = `${COUNTDOWN}_digits`;
  plane.position.set(centre.x, centre.y, bounds.max.z + 0.002);
  plane.visible = false;
  plane.userData.digits = '';
  object.add(plane);
  return {
    show(style) {
      plane.visible = style.digits !== '';
      plane.material.color.set(style.color).multiplyScalar(style.intensity);
      if (style.digits === plane.userData.digits) return;
      plane.userData.digits = style.digits;
      paintCountdown(context, style.digits, canvas.width, canvas.height);
      texture.needsUpdate = true;
    },
    dispose() {
      plane.removeFromParent();
      plane.geometry.dispose();
      plane.material.dispose();
      texture.dispose();
    },
  };
}

export function createSignalLook(
  THREE,
  root,
  { createCanvas = () => globalThis.document.createElement('canvas') } = {},
) {
  const bulbs = [];
  const found = [];
  root.traverse((object) => {
    if (object.isMesh && BULBS[object.name]) found.push(object);
  });
  for (const object of found) {
    const previous = object.material;
    const material = new THREE.MeshStandardMaterial({
      color: '#171717',
      emissive: '#000000',
      roughness: 0.4,
      toneMapped: false,
    });
    object.material = material;
    if (object.userData.ownedMaterial) previous.dispose();
    const display =
      object.name === COUNTDOWN ? countdownDisplay(THREE, object, createCanvas) : null;
    bulbs.push({ object, material, display });
  }
  return {
    update(state) {
      for (const { object, material, display } of bulbs) {
        const style = signalBulbStyle(object.name, state);
        if (display) {
          material.emissive.set('#000000');
          material.emissiveIntensity = 0;
          display.show(style);
        } else {
          material.emissive.set(style.color);
          material.emissiveIntensity = style.intensity;
        }
      }
    },
    dispose() {
      for (const { material, display } of bulbs) {
        material.dispose();
        display?.dispose();
      }
    },
  };
}

export function createStreetLampLook(THREE, root) {
  const owned = [];
  root.traverse((object) => {
    const style = object.isMesh ? streetLampStyle(object.name) : null;
    if (!style) return;
    const previous = object.material;
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.color).multiplyScalar(style.intensity),
      toneMapped: false,
    });
    object.material = material;
    if (object.userData.ownedMaterial) previous.dispose();
    owned.push(material);
  });
  return {
    dispose() {
      for (const material of owned) material.dispose();
    },
  };
}
