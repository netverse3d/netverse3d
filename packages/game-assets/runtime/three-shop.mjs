import { instanceGroups, paletteImage } from './shop-look.mjs';

export function paletteTexture(THREE, image) {
  const texture = new THREE.DataTexture(image.data, image.width, image.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function shopMaterials(THREE, recipe, rows, { roughness = 0.62, glowBoost = 1.7 } = {}) {
  const palette = paletteTexture(THREE, paletteImage(rows, recipe.palette));
  const emissive = paletteTexture(THREE, paletteImage(rows, recipe.emissive ?? {}));
  const surface = new THREE.MeshStandardMaterial({
    map: palette,
    roughness,
    emissiveMap: emissive,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1,
  });
  const glow = new THREE.MeshBasicMaterial({ map: palette, toneMapped: false });
  glow.color.setScalar(glowBoost);
  return { surface, glow };
}

export function buildShop(THREE, kitScene, plan, materials) {
  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [part, placements] of instanceGroups(plan)) {
    const source = kitScene.getObjectByName(part);
    if (!source) throw new Error(`kit has no part ${part}`);
    source.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const material = materials[mesh.material.name] ?? materials.surface;
      const instanced = new THREE.InstancedMesh(mesh.geometry, material, placements.length);
      placements.forEach((placement, index) => {
        rotation.setFromAxisAngle(up, placement.yaw);
        position.set(...placement.position);
        instanced.setMatrixAt(index, matrix.compose(position, rotation, unit));
      });
      instanced.instanceMatrix.needsUpdate = true;
      instanced.frustumCulled = false;
      group.add(instanced);
    });
  }
  return group;
}
