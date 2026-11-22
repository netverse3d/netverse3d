import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  buildStreet,
  streetAssemblyPlan,
  streetDrawCounts,
  selectStreetLod,
} from './street-instancing.mjs';

const primitives = {
  road_a: ['road_a', 'road_a_marking'],
  signal_a: ['signal_a', 'signal_a_bulb_red', 'signal_a_bulb_green'],
  walk_a: ['walk_a', 'walk_a_stop', 'walk_a_go'],
  car_a: ['car_a', 'car_a_wheel_front', 'car_a_lights_head'],
};
const placements = [
  { part: 'road_a', position: [0, 0, 0], yaw: 0 },
  { part: 'road_a', position: [4, 0, 0], yaw: Math.PI / 2 },
  { part: 'signal_a', position: [0, 0, 4], yaw: 0 },
  { part: 'signal_a', position: [4, 0, 4], yaw: Math.PI },
  { part: 'walk_a', position: [0, 0, 8], yaw: 0 },
  { part: 'car_a', position: [0, 0, 12], yaw: 0 },
];

test('gộp từng primitive tĩnh theo part và giữ biến đổi của mọi vị trí', () => {
  const groups = streetAssemblyPlan(placements, primitives);
  assert.deepEqual(
    groups
      .filter((group) => group.mode === 'instance')
      .map((group) => [group.part, group.primitive, group.placements.length]),
    [
      ['road_a', 'road_a', 2],
      ['road_a', 'road_a_marking', 2],
      ['signal_a', 'signal_a', 2],
      ['walk_a', 'walk_a', 1],
    ],
  );
  assert.deepEqual(groups[0].placements[1], placements[1]);
});

test('giữ riêng thân sơn, bánh, đèn xe và bóng đèn giao thông theo quy tắc dữ liệu', () => {
  const groups = streetAssemblyPlan(placements, primitives);
  const individual = groups.filter((group) => group.mode === 'individual');
  assert.deepEqual(
    individual.map((group) => [group.primitive, group.placements.length]),
    [
      ['signal_a_bulb_red', 2],
      ['signal_a_bulb_green', 2],
      ['walk_a_stop', 1],
      ['walk_a_go', 1],
      ['car_a', 1],
      ['car_a_wheel_front', 1],
      ['car_a_lights_head', 1],
    ],
  );
  assert.deepEqual(streetDrawCounts(groups), { before: 16, after: 13 });
});

test('chọn LOD theo khoảng cách và giữ bản gốc khi chưa khai', () => {
  assert.equal(selectStreetLod('storey_a', 30), 'storey_a');
  assert.equal(selectStreetLod('storey_a', 30, { suffix: 'low', distance: 32 }), 'storey_a');
  assert.equal(selectStreetLod('storey_a', 32, { suffix: 'low', distance: 32 }), 'storey_a_low');
});

test('lắp phố thành instance tĩnh và bóng đèn riêng có vật liệu độc lập', () => {
  const kit = new THREE.Group();
  const signal = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  signal.name = 'signal_a';
  signal.material.name = 'surface';
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial());
  bulb.name = 'signal_a_bulb_red';
  bulb.material.name = 'glow';
  bulb.position.y = 2;
  signal.add(bulb);
  kit.add(signal);
  const materials = { surface: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial() };
  const street = buildStreet(
    THREE,
    kit,
    placements.filter((item) => item.part === 'signal_a'),
    materials,
  );
  assert.equal(street.children.length, 3);
  assert.equal(street.children[0].isInstancedMesh, true);
  assert.equal(street.children[0].count, 2);
  assert.equal(street.children[1].isInstancedMesh, undefined);
  assert.notEqual(street.children[1].material, street.children[2].material);
  assert.deepEqual(
    street.children.slice(1).map((mesh) => Math.round(mesh.matrix.elements[13])),
    [2, 2],
  );
});
