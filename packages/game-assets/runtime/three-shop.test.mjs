import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  buildShop,
  isPreviewLightmap,
  kitLightmap,
  previewKitFiles,
  paletteTexture,
  recolorShowcase,
  rowColor,
  shopMaterials,
  showcaseMaterials,
} from './three-shop.mjs';
import { paletteImage } from './shop-look.mjs';

const ROWS = ['body', 'soft', 'strip', 'keycap'];
const RECIPE = {
  palette: {
    body: ['#1a1428'],
    soft: ['#14101d'],
    strip: ['#a835ff'],
    keycap: ['#0aa0c8', '#c0189a'],
  },
};

function kitScene() {
  const scene = new THREE.Group();
  const desk = new THREE.Group();
  desk.name = 'desk_a';
  for (const name of ['surface', 'glow']) {
    const material = new THREE.MeshStandardMaterial();
    material.name = name;
    desk.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  }
  const monitor = new THREE.Group();
  monitor.name = 'monitor_a';
  const screen = new THREE.MeshStandardMaterial();
  screen.name = 'display';
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(), screen);
  panel.position.set(0, 0.3, 0);
  monitor.add(panel);
  scene.add(desk, monitor);
  return scene;
}

function planFor(stations) {
  return stations.flatMap((position, station) => [
    { station, slot: 'desk', part: 'desk_a', position, yaw: 0 },
    {
      station,
      slot: 'monitor',
      part: 'monitor_a',
      position: [position[0], 0.7, position[2]],
      yaw: Math.PI / 2,
    },
  ]);
}

test('ảnh dải màu thành texture sRGB không lật', () => {
  const texture = paletteTexture(THREE, paletteImage(ROWS, RECIPE.palette));
  assert.equal(texture.image.width, 128);
  assert.equal(texture.image.height, 4);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.flipY, false);
});

test('vật liệu tiệm có đủ bốn tên của bộ ô đồ', () => {
  const materials = shopMaterials(THREE, RECIPE, ROWS);
  assert.deepEqual(Object.keys(materials).sort(), [
    'decal',
    'display',
    'glow',
    'legend',
    'surface',
  ]);
  assert.equal(materials.surface.map, materials.glow.map);
  assert.ok(materials.surface.emissiveMap);
});

test('vật liệu bề mặt nhận lightmap nướng sẵn ở kênh UV thứ hai khi được đưa vào', () => {
  const lightmap = new THREE.Texture();
  lightmap.channel = 1;
  const lit = shopMaterials(THREE, RECIPE, ROWS, { lightmap });
  assert.equal(lit.surface.aoMap, lightmap);
  assert.equal(lit.surface.aoMapIntensity, 1);
  assert.equal(lit.glow.aoMap, null);
  const plain = shopMaterials(THREE, RECIPE, ROWS);
  assert.equal(plain.surface.aoMap, null);
});

test('không có lightmap thì không truyền khoá aoMap rỗng và không cảnh báo', () => {
  const warned = [];
  const original = console.warn;
  console.warn = (...args) => warned.push(args.join(' '));
  try {
    const plain = shopMaterials(THREE, RECIPE, ROWS);
    assert.equal(plain.surface.aoMap, null);
    assert.deepEqual(warned, []);
  } finally {
    console.warn = original;
  }
});

test('lấy lightmap từ vật liệu bề mặt của bộ ô đồ đã tải, không có thì trả null', () => {
  const scene = kitScene();
  assert.equal(kitLightmap(scene), null);
  const lightmap = new THREE.Texture();
  scene.traverse((object) => {
    if (object.isMesh && object.material.name === 'surface') object.material.aoMap = lightmap;
  });
  assert.equal(kitLightmap(scene), lightmap);
});

test('mỗi primitive thành một InstancedMesh với số instance bằng số máy', () => {
  const materials = shopMaterials(THREE, RECIPE, ROWS);
  const stations = [
    [-1, 0, -1],
    [1, 0, -1],
    [-1, 0, 1],
  ];
  const shop = buildShop(THREE, kitScene(), planFor(stations), materials);
  const meshes = shop.children.filter((child) => child.isInstancedMesh);
  assert.equal(meshes.length, 3);
  assert.deepEqual(
    meshes.map((mesh) => mesh.count),
    [3, 3, 3],
  );
  assert.equal(meshes[0].material, materials.surface);
  assert.equal(meshes[1].material, materials.glow);
  assert.equal(meshes[2].material, materials.display);
});

test('instance giữ vị trí, góc quay và transform cục bộ của mesh con', () => {
  const materials = shopMaterials(THREE, RECIPE, ROWS);
  const shop = buildShop(THREE, kitScene(), planFor([[-1, 0, -1]]), materials);
  const screen = shop.children[2];
  const matrix = new THREE.Matrix4();
  screen.getMatrixAt(0, matrix);
  const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.deepEqual(
    [position.x, position.y, position.z].map((v) => Math.round(v * 1000) / 1000),
    [-1, 1, -1],
  );
  const rotation = new THREE.Euler().setFromRotationMatrix(matrix);
  assert.equal(Math.round(rotation.y * 1000) / 1000, Math.round((Math.PI / 2) * 1000) / 1000);
});

test('món dùng vật liệu không có trong tiệm thì báo lỗi', () => {
  const { display, ...materials } = shopMaterials(THREE, RECIPE, ROWS);
  assert.ok(display);
  assert.throws(
    () => buildShop(THREE, kitScene(), planFor([[0, 0, 0]]), materials),
    /monitor_a uses material display without a shop material/,
  );
});

test('kế hoạch nhắc tới món không có trong bộ thì báo lỗi', () => {
  const materials = shopMaterials(THREE, RECIPE, ROWS);
  const plan = [{ station: 0, slot: 'chair', part: 'chair_z', position: [0, 0, 0], yaw: 0 }];
  assert.throws(() => buildShop(THREE, kitScene(), plan, materials), /kit has no part chair_z/);
});

test('vật liệu showcase lấy màu lan sáng từ công thức và đổi theo khi đổi công thức', () => {
  const base = new THREE.Texture();
  const spill = new THREE.Texture();
  const materials = showcaseMaterials(THREE, RECIPE, ROWS, {
    base,
    spill,
    spillStrength: [2, 1, 0.5],
  });
  assert.ok(materials.surface.isShaderMaterial);
  assert.equal(materials.surface.uniforms.base.value, base);
  assert.equal(materials.surface.uniforms.spill.value, spill);
  assert.equal(materials.surface.uniforms.stripColor.value.getHexString(), 'a835ff');
  assert.deepEqual(materials.surface.uniforms.spillStrength.value.toArray(), [2, 1, 0.5]);
  assert.equal(materials.surface.uniforms.palette.value, materials.glow.map);
  recolorShowcase(THREE, materials, { palette: { ...RECIPE.palette, strip: ['#00ff00'] } }, ROWS);
  assert.equal(materials.surface.uniforms.stripColor.value.getHexString(), '00ff00');
  assert.equal(materials.surface.uniforms.palette.value, materials.glow.map);
});

test('màu của hàng nhiều mốc là trung bình các mốc', () => {
  const color = rowColor(THREE, { palette: { keycap: ['#000000', '#ffffff'] } }, 'keycap');
  assert.ok(Math.abs(color.r - 0.5) < 0.01);
  assert.equal(rowColor(THREE, { palette: {} }, 'strip').getHexString(), 'ffffff');
});

test('lightmap xem thử nhận ra qua hậu tố tên ảnh, lightmap thật và thiếu lightmap thì không', () => {
  const preview = new THREE.Texture();
  preview.name = 'station-parts-lightmap-preview';
  const baked = new THREE.Texture();
  baked.name = 'station-parts-lightmap';
  assert.equal(isPreviewLightmap(preview), true);
  assert.equal(isPreviewLightmap(baked), false);
  assert.equal(isPreviewLightmap(null), false);
});

test('liệt kê các bộ đã tải đang mang lightmap xem thử', () => {
  const previewScene = kitScene();
  const texture = new THREE.Texture();
  texture.name = 'lounge-parts-lightmap-preview';
  previewScene.traverse((object) => {
    if (object.isMesh && object.material.name === 'surface') object.material.aoMap = texture;
  });
  const kits = {
    'station-parts.glb': { scene: kitScene() },
    'lounge-parts.glb': { scene: previewScene },
  };
  assert.deepEqual(previewKitFiles(kits), ['lounge-parts.glb']);
  assert.deepEqual(previewKitFiles({}), []);
});
