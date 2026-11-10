import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { buildShop, paletteTexture, shopMaterials } from './three-shop.mjs';
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
  assert.deepEqual(Object.keys(materials).sort(), ['decal', 'display', 'glow', 'surface']);
  assert.equal(materials.surface.map, materials.glow.map);
  assert.ok(materials.surface.emissiveMap);
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
