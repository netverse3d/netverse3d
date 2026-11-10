import { instanceGroups, paletteImage } from './shop-look.mjs';

export function paletteTexture(THREE, image) {
  const texture = new THREE.DataTexture(image.data, image.width, image.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const AO_INCLUDE = '#include <aomap_fragment>';
const AO_DIRECT = `${AO_INCLUDE}
#ifdef USE_AOMAP
reflectedLight.directDiffuse *= ambientOcclusion;
reflectedLight.directSpecular *= ambientOcclusion;
#endif`;

export function occludeDirectLight(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(AO_INCLUDE, AO_DIRECT);
}

export function kitLightmap(kitScene) {
  let found = null;
  kitScene.traverse((object) => {
    if (!found && object.isMesh && object.material?.name === 'surface' && object.material.aoMap) {
      found = object.material.aoMap;
    }
  });
  return found;
}

export function shopMaterials(
  THREE,
  recipe,
  rows,
  { roughness = 0.62, glowBoost = 1.2, lightmap = null, lightmapIntensity = 1 } = {},
) {
  const palette = paletteTexture(THREE, paletteImage(rows, recipe.palette));
  const emissive = paletteTexture(THREE, paletteImage(rows, recipe.emissive ?? {}));
  const surface = new THREE.MeshStandardMaterial({
    map: palette,
    roughness,
    emissiveMap: emissive,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1,
    aoMap: lightmap ?? undefined,
    aoMapIntensity: lightmapIntensity,
  });
  if (lightmap) surface.onBeforeCompile = occludeDirectLight;
  const glow = new THREE.MeshBasicMaterial({ map: palette, toneMapped: false });
  glow.color.setScalar(glowBoost);
  const display = new THREE.MeshBasicMaterial({ color: '#0a0a14', toneMapped: false });
  const decal = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  return { surface, glow, display, decal };
}

export function buildShop(THREE, kitScene, plan, materials) {
  const group = new THREE.Group();
  const matrix = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  for (const [part, placements] of instanceGroups(plan)) {
    const source = kitScene.getObjectByName(part);
    if (!source) throw new Error(`kit has no part ${part}`);
    source.updateWorldMatrix(true, true);
    source.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const material = materials[mesh.material.name];
      if (!material)
        throw new Error(`${part} uses material ${mesh.material.name} without a shop material`);
      local.copy(source.matrixWorld).invert().multiply(mesh.matrixWorld);
      const instanced = new THREE.InstancedMesh(mesh.geometry, material, placements.length);
      placements.forEach((placement, index) => {
        rotation.setFromAxisAngle(up, placement.yaw);
        position.set(...placement.position);
        instanced.setMatrixAt(index, matrix.compose(position, rotation, unit).multiply(local));
      });
      instanced.instanceMatrix.needsUpdate = true;
      instanced.frustumCulled = false;
      group.add(instanced);
    });
  }
  return group;
}
