import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { EMISSIVE_SCALE } from './lighting.mjs';
import { paletteRows } from './shop-look.mjs';
import { shopMaterials } from './three-shop.mjs';
import { createVehicle, paintColorFor, vehicleLightStyle } from './vehicle-look.mjs';

test('màu sơn xe ổn định theo định danh và thuộc bảng màu thực tế', () => {
  assert.equal(paintColorFor('lo-1:bike-0'), paintColorFor('lo-1:bike-0'));
  assert.match(paintColorFor('lo-1:bike-0'), /^#[0-9a-f]{6}$/);
  assert.ok(new Set(Array.from({ length: 24 }, (_, i) => paintColorFor(`xe-${i}`))).size > 1);
});

test('đèn đầu trắng và đèn hậu đỏ dùng đúng thang phát sáng xe', () => {
  const head = vehicleLightStyle('car_a_lights_head');
  const tail = vehicleLightStyle('motorbike_b_lights_tail');
  assert.equal(head.color, '#ffffff');
  assert.equal(tail.color, '#ff2020');
  assert.equal(head.intensity, EMISSIVE_SCALE.vehicleHeadlight.default);
  assert.equal(tail.intensity, EMISSIVE_SCALE.vehicleTaillight.default);
  assert.equal(vehicleLightStyle('car_a_wheel_fl'), null);
});

test('hai xe dùng chung hình học nhưng có màu sơn và đèn riêng từng chiếc', () => {
  const config = {
    palette: { surface: ['trim'], glow: ['screen'] },
  };
  const rows = paletteRows(config.palette);
  const recipe = { palette: { trim: ['#333333'], screen: ['#ffffff'] } };
  const materials = shopMaterials(THREE, recipe, rows);
  const kit = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  body.name = 'car_a';
  body.material.name = 'surface';
  const head = new THREE.Mesh(body.geometry, new THREE.MeshBasicMaterial());
  head.name = 'car_a_lights_head';
  head.material.name = 'glow';
  body.add(head);
  kit.add(body);
  const first = createVehicle(THREE, kit, 'car_a', materials, recipe, rows, 'xe-a');
  const second = createVehicle(THREE, kit, 'car_a', materials, recipe, rows, 'xe-b');
  assert.equal(first.geometry, second.geometry);
  assert.notEqual(first.material.map, second.material.map);
  assert.notEqual(first.material.map, materials.surface.map);
  assert.notEqual(
    first.getObjectByName(head.name).material,
    second.getObjectByName(head.name).material,
  );
  assert.equal(head.material.name, 'glow');
  first.userData.disposeVehicle();
  second.userData.disposeVehicle();
  body.geometry.dispose();
  for (const material of Object.values(materials)) material.dispose();
});
