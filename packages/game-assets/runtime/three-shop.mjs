import { EMISSIVE_SCALE } from './lighting.mjs';
import { instanceGroups, paletteImage } from './shop-look.mjs';

export { EMISSIVE_SCALE };

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

export const PREVIEW_SUFFIX = '-preview';

export function isPreviewLightmap(texture) {
  return Boolean(texture?.name?.endsWith(PREVIEW_SUFFIX));
}

export function previewKitFiles(kits) {
  return Object.entries(kits)
    .filter(([, gltf]) => isPreviewLightmap(kitLightmap(gltf.scene)))
    .map(([file]) => file);
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
    glowBoost = EMISSIVE_SCALE.neon.default,
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

export function buildShop(
  THREE,
  kitScene,
  plan,
  materials,
  { individualPrimitive = () => false, instance = true } = {},
) {
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
      const sharedMaterial = materials[mesh.material.name];
      if (!sharedMaterial)
        throw new Error(`${part} uses material ${mesh.material.name} without a shop material`);
      const monitorDisplay = part.startsWith('monitor_') && mesh.material.name === 'display';
      const ownedMaterial = () => {
        const material = sharedMaterial.clone();
        if (monitorDisplay) material.color.set('#ffffff');
        return material;
      };
      local.copy(source.matrixWorld).invert().multiply(mesh.matrixWorld);
      if (!instance || individualPrimitive(part, mesh.name)) {
        for (const placement of placements) {
          rotation.setFromAxisAngle(up, placement.yaw);
          position.set(...placement.position);
          const individual = mesh.clone(false);
          individual.material = ownedMaterial();
          individual.matrixAutoUpdate = false;
          individual.matrix.copy(matrix.compose(position, rotation, unit).multiply(local));
          individual.userData.ownedMaterial = true;
          group.add(individual);
        }
        return;
      }
      const instanced = new THREE.InstancedMesh(
        mesh.geometry,
        monitorDisplay ? ownedMaterial() : sharedMaterial,
        placements.length,
      );
      placements.forEach((placement, index) => {
        rotation.setFromAxisAngle(up, placement.yaw);
        position.set(...placement.position);
        instanced.setMatrixAt(index, matrix.compose(position, rotation, unit).multiply(local));
      });
      instanced.instanceMatrix.needsUpdate = true;
      instanced.frustumCulled = false;
      instanced.userData.part = part;
      instanced.userData.material = mesh.material.name;
      instanced.userData.ownedMaterial = monitorDisplay;
      instanced.userData.local = local.clone();
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
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
void main() {
  vPalette = uv;
  vLightmap = uv1;
  #include <begin_vertex>
  #include <project_vertex>
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
}`;

const SHOWCASE_REFLECTION_LIMIT = 6;
const SHOWCASE_FRAGMENT = `
uniform sampler2D palette;
uniform sampler2D base;
uniform sampler2D spill;
uniform float ambient;
uniform vec3 stripColor;
uniform vec3 screenColor;
uniform vec3 accentColor;
uniform vec3 spillStrength;
uniform float wetness;
uniform float roughness;
uniform float rainTime;
uniform vec4 reflectionSources[${SHOWCASE_REFLECTION_LIMIT}];
varying vec2 vPalette;
varying vec2 vLightmap;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), blend.x), blend.y);
}
float ripple(vec2 point) {
  vec2 cell = floor(point);
  vec2 offset = vec2(hash(cell), hash(cell + 17.0)) * 0.4 + 0.3;
  float age = fract(rainTime * 1.35 + hash(cell + 2.0));
  float radius = length(fract(point) - offset);
  return (1.0 - smoothstep(0.015, 0.05, abs(radius - age * 0.28))) * (1.0 - age);
}
vec3 streak(vec4 source, vec2 point, float rings) {
  if (source.y <= 0.0) return vec3(0.0);
  vec2 toCamera = cameraPosition.xz - source.xz;
  vec2 direction = toCamera / max(length(toCamera), 0.001);
  vec2 centre = source.xz + toCamera * source.y / max(cameraPosition.y + source.y, 0.1);
  vec2 relative = point - centre;
  float along = dot(relative, direction);
  float lateral = dot(relative, vec2(-direction.y, direction.x)) + (rings - 0.1) * 0.18;
  float width = mix(0.16, 0.45, roughness);
  float falloff = exp(-lateral * lateral / (width * width) - along * along / 4.0);
  vec3 tint = source.w > 0.5 ? vec3(1.0, 0.64, 0.29) : mix(accentColor, stripColor, 0.55);
  return tint * falloff * (source.w > 0.5 ? 0.9 : 0.7);
}
void main() {
  vec3 albedo = texture2D(palette, vPalette).rgb;
  vec3 masks = texture2D(spill, vLightmap).rgb;
  vec3 light = texture2D(base, vLightmap).rgb * ambient
    + masks.r * stripColor * spillStrength.x
    + masks.g * screenColor * spillStrength.y
    + masks.b * accentColor * spillStrength.z;
  vec3 color = albedo * light;
  if (wetness > 0.0) {
    vec2 point = vWorldPosition.xz;
    float puddle = smoothstep(0.42, 0.65,
      noise(point * vec2(0.55, 1.1)) * 0.78 + noise(point * 3.1) * 0.22);
    float horizontal = smoothstep(0.72, 0.98, normalize(vWorldNormal).y);
    float gloss = (1.0 - roughness) * wetness * puddle * horizontal;
    float rings = ripple(point * 2.8);
    float grazing = 1.0 - max(dot(normalize(cameraPosition - vWorldPosition), vec3(0.0, 1.0, 0.0)), 0.0);
    vec3 reflections = vec3(0.1, 0.11, 0.2) * grazing * grazing;
    for (int index = 0; index < ${SHOWCASE_REFLECTION_LIMIT}; index++) {
      reflections += streak(reflectionSources[index], point, rings);
    }
    color *= 1.0 - gloss * 0.32;
    color += (reflections * (0.55 + 0.45 * grazing) + rings * vec3(0.12, 0.15, 0.22)) * gloss;
  }
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function placeInstance(THREE, shop, part, index, position, yaw) {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const unit = new THREE.Vector3(1, 1, 1);
  for (const mesh of shop.children) {
    if (mesh.userData.part !== part) continue;
    matrix.compose(new THREE.Vector3(...position), rotation, unit).multiply(mesh.userData.local);
    mesh.setMatrixAt(index, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

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
  {
    base,
    spill,
    ambient = 6,
    spillStrength = [8, 6, 6],
    glowBoost = EMISSIVE_SCALE.neon.default,
    wetness = 0,
    roughness = 0.85,
  } = {},
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
      wetness: { value: wetness },
      roughness: { value: roughness },
      rainTime: { value: 0 },
      reflectionSources: {
        value: Array.from({ length: SHOWCASE_REFLECTION_LIMIT }, () => new THREE.Vector4()),
      },
    },
    vertexShader: SHOWCASE_VERTEX,
    fragmentShader: SHOWCASE_FRAGMENT,
  });
  materials.surface.roughness = roughness;
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
