import { EMISSIVE_SCALE } from './lighting.mjs';

const BULBS = {
  signal_a_bulb_red: { color: '#ff2a2a', phase: 'red', kind: 'vehicle' },
  signal_a_bulb_yellow: { color: '#ffb52a', phase: 'yellow', kind: 'vehicle' },
  signal_a_bulb_green: { color: '#26ef65', phase: 'green', kind: 'vehicle' },
  signal_a_countdown: { color: '#ffb52a', phase: 'countdown', kind: 'vehicle' },
  walk_a_stop: { color: '#ff2a2a', phase: 'stop', kind: 'pedestrian' },
  walk_a_go: { color: '#26ef65', phase: 'go', kind: 'pedestrian' },
};

export function signalBulbStyle(name, state) {
  const bulb = BULBS[name];
  if (!bulb) return null;
  const active =
    bulb.phase === 'countdown'
      ? state.vehicle === 'yellow' && state.remaining > 0
      : state[bulb.kind] === bulb.phase;
  return {
    color: bulb.color,
    intensity: active
      ? EMISSIVE_SCALE.trafficSignal.default
      : EMISSIVE_SCALE.trafficSignal.default * 0.08,
  };
}

export function createSignalLook(THREE, root) {
  const bulbs = [];
  root.traverse((object) => {
    if (!object.isMesh || !BULBS[object.name]) return;
    const previous = object.material;
    const material = new THREE.MeshStandardMaterial({
      color: '#171717',
      emissive: '#000000',
      roughness: 0.4,
      toneMapped: false,
    });
    object.material = material;
    if (object.userData.ownedMaterial) previous.dispose();
    bulbs.push({ object, material });
  });
  return {
    update(state) {
      for (const { object, material } of bulbs) {
        const style = signalBulbStyle(object.name, state);
        material.emissive.set(style.color);
        material.emissiveIntensity = style.intensity;
      }
    },
    dispose() {
      for (const { material } of bulbs) material.dispose();
    },
  };
}
