import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSignalLook, signalBulbStyle } from './signal-look.mjs';
import { EMISSIVE_SCALE } from './lighting.mjs';
import * as THREE from 'three';

test('bóng đèn sáng đúng pha và bóng tắt vẫn còn màu mờ', () => {
  const green = signalBulbStyle('signal_a_bulb_green', { vehicle: 'green', pedestrian: 'stop' });
  const red = signalBulbStyle('signal_a_bulb_red', { vehicle: 'green', pedestrian: 'stop' });
  assert.equal(green.color, '#26ef65');
  assert.equal(green.intensity, EMISSIVE_SCALE.trafficSignal.default);
  assert.ok(red.intensity > 0 && red.intensity < green.intensity);
  assert.equal(
    signalBulbStyle('signal_a_countdown', { vehicle: 'yellow', remaining: 1 }).intensity,
    EMISSIVE_SCALE.trafficSignal.default,
  );
  assert.equal(
    signalBulbStyle('walk_a_go', { pedestrian: 'go' }).intensity,
    EMISSIVE_SCALE.trafficSignal.default,
  );
  assert.equal(signalBulbStyle('walk_a_stop', { pedestrian: 'go' }).intensity, red.intensity);
  assert.equal(signalBulbStyle('unknown', { vehicle: 'red' }), null);
});

test('mỗi bóng có vật liệu riêng và bộ điều khiển giải phóng vật liệu', () => {
  const shared = new THREE.MeshBasicMaterial();
  const first = new THREE.Mesh(new THREE.BoxGeometry(), shared);
  first.name = 'signal_a_bulb_red';
  const second = first.clone();
  const root = new THREE.Group();
  root.add(first, second);
  const look = createSignalLook(THREE, root);
  assert.notEqual(first.material, second.material);
  look.update({ vehicle: 'red' });
  assert.equal(first.material.emissiveIntensity, EMISSIVE_SCALE.trafficSignal.default);
  assert.equal(second.material.emissiveIntensity, EMISSIVE_SCALE.trafficSignal.default);
  let disposed = 0;
  first.material.addEventListener('dispose', () => disposed++);
  second.material.addEventListener('dispose', () => disposed++);
  look.dispose();
  assert.equal(disposed, 2);
  first.geometry.dispose();
  shared.dispose();
});
