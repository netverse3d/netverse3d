import { EMISSIVE_SCALE } from './lighting.mjs';
import { hexToBytes, paletteImage } from './shop-look.mjs';
import { paletteTexture } from './three-shop.mjs';

export const VEHICLE_PAINT_COLORS = [
  '#29343b',
  '#e4e3dd',
  '#8e969a',
  '#681e27',
  '#183b5a',
  '#6d604e',
];

const PAINT_KEYS = { car_a: 0.5, car_b: 0.05, motorbike_a: 0.08, motorbike_b: 0.5 };

export function paintColorFor(id) {
  let hash = 2166136261;
  for (const character of String(id)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return VEHICLE_PAINT_COLORS[(hash >>> 0) % VEHICLE_PAINT_COLORS.length];
}

export function vehicleLightStyle(name) {
  if (name.endsWith('_lights_head'))
    return { color: '#ffffff', intensity: EMISSIVE_SCALE.vehicleHeadlight.default };
  if (name.endsWith('_lights_tail'))
    return { color: '#ff2020', intensity: EMISSIVE_SCALE.vehicleTaillight.default };
  return null;
}

function paintTexture(THREE, recipe, rows, part, color) {
  const image = paletteImage(rows, recipe.palette);
  const row = rows.indexOf('trim');
  const column = Math.round(PAINT_KEYS[part] * (image.width - 1));
  const rgb = hexToBytes(color);
  for (let offset = -1; offset <= 1; offset += 1) {
    const at = (row * image.width + column + offset) * 4;
    image.data.set(rgb, at);
  }
  return paletteTexture(THREE, image);
}

export function createVehicle(THREE, kitScene, part, materials, recipe, rows, id) {
  const source = kitScene.getObjectByName(part);
  if (!source || PAINT_KEYS[part] === undefined) throw new Error(`kit has no vehicle ${part}`);
  const vehicle = source.clone(true);
  const surface = materials.surface.clone();
  surface.map = paintTexture(THREE, recipe, rows, part, paintColorFor(id));
  surface.needsUpdate = true;
  const owned = [surface, surface.map];
  vehicle.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const light = vehicleLightStyle(mesh.name);
    if (light) {
      mesh.material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(light.color).multiplyScalar(light.intensity),
        toneMapped: false,
      });
      owned.push(mesh.material);
    } else {
      mesh.material = mesh.material.name === 'surface' ? surface : materials[mesh.material.name];
      if (!mesh.material) throw new Error(`${mesh.name} has no vehicle material`);
    }
  });
  vehicle.userData.disposeVehicle = () => owned.forEach((item) => item.dispose());
  return vehicle;
}
