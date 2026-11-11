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
  {
    roughness = 0.62,
    glowBoost = 1.2,
    lightmap = null,
    lightmapIntensity = 1,
    legends = null,
  } = {},
) {
  const palette = paletteTexture(THREE, paletteImage(rows, recipe.palette));
  const emissive = paletteTexture(THREE, paletteImage(rows, recipe.emissive ?? {}));
  const surface = new THREE.MeshStandardMaterial({
    map: palette,
    roughness,
    emissiveMap: emissive,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1,
    ...(lightmap ? { aoMap: lightmap, aoMapIntensity: lightmapIntensity } : {}),
  });
  if (lightmap) surface.onBeforeCompile = occludeDirectLight;
  const glow = new THREE.MeshBasicMaterial({ map: palette, toneMapped: false });
  glow.color.setScalar(glowBoost);
  const display = new THREE.MeshBasicMaterial({ color: '#0a0a14', toneMapped: false });
  const decal = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const legendMap = legends?.isTexture ? legends : (legends?.map ?? null);
  const legendGlow = legends?.emissive ?? null;
  const legend = new THREE.MeshStandardMaterial({
    map: legendMap,
    color: legendMap ? '#ffffff' : '#5a5668',
    roughness: 0.7,
    envMapIntensity: 0.6,
    ...(legendGlow
      ? {
          emissiveMap: legendGlow,
          emissive: new THREE.Color('#ffffff'),
          emissiveIntensity: glowBoost,
        }
      : {}),
    ...(lightmap ? { aoMap: lightmap, aoMapIntensity: lightmapIntensity } : {}),
  });
  if (lightmap) legend.onBeforeCompile = occludeDirectLight;
  return { surface, glow, display, decal, legend };
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

const SHOWCASE_VERTEX = `
#include <common>
attribute vec2 uv1;
varying vec2 vPalette;
varying vec2 vLightmap;
void main() {
  vPalette = uv;
  vLightmap = uv1;
  #include <begin_vertex>
  #include <project_vertex>
}`;

const SHOWCASE_FRAGMENT = `
uniform sampler2D palette;
uniform sampler2D base;
uniform sampler2D spill;
uniform float ambient;
uniform vec3 stripColor;
uniform vec3 screenColor;
uniform vec3 accentColor;
uniform vec3 spillStrength;
varying vec2 vPalette;
varying vec2 vLightmap;
void main() {
  vec3 albedo = texture2D(palette, vPalette).rgb;
  vec3 masks = texture2D(spill, vLightmap).rgb;
  vec3 light = texture2D(base, vLightmap).rgb * ambient
    + masks.r * stripColor * spillStrength.x
    + masks.g * screenColor * spillStrength.y
    + masks.b * accentColor * spillStrength.z;
  gl_FragColor = vec4(albedo * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function rowColor(THREE, recipe, row) {
  const stops = recipe.palette[row] ?? ['#ffffff'];
  const color = new THREE.Color(0, 0, 0);
  for (const stop of stops) color.add(new THREE.Color(stop));
  return color.multiplyScalar(1 / stops.length);
}

export function showcaseMaterials(
  THREE,
  recipe,
  rows,
  { base, spill, ambient = 6, spillStrength = [8, 6, 6], glowBoost = 1.2 } = {},
) {
  const materials = shopMaterials(THREE, recipe, rows, { glowBoost });
  materials.surface.dispose();
  materials.surface = new THREE.ShaderMaterial({
    uniforms: {
      palette: { value: materials.glow.map },
      base: { value: base },
      spill: { value: spill },
      ambient: { value: ambient },
      stripColor: { value: rowColor(THREE, recipe, 'strip') },
      screenColor: { value: rowColor(THREE, recipe, 'screen') },
      accentColor: { value: rowColor(THREE, recipe, 'accent') },
      spillStrength: { value: new THREE.Vector3(...spillStrength) },
    },
    vertexShader: SHOWCASE_VERTEX,
    fragmentShader: SHOWCASE_FRAGMENT,
  });
  return materials;
}

export function recolorShowcase(THREE, materials, recipe, rows) {
  const palette = paletteTexture(THREE, paletteImage(rows, recipe.palette));
  const { uniforms } = materials.surface;
  uniforms.palette.value.dispose();
  uniforms.palette.value = palette;
  uniforms.stripColor.value.copy(rowColor(THREE, recipe, 'strip'));
  uniforms.screenColor.value.copy(rowColor(THREE, recipe, 'screen'));
  uniforms.accentColor.value.copy(rowColor(THREE, recipe, 'accent'));
  materials.glow.map = palette;
  materials.glow.needsUpdate = true;
}
