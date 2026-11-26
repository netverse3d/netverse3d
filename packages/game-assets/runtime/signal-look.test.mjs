import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STREET_LAMP_LED_NAMES,
  countdownDigits,
  createSignalLook,
  createStreetLampLook,
  paintCountdown,
  signalBulbStyle,
  streetLampStyle,
} from './signal-look.mjs';
import { EMISSIVE_SCALE, isWithinEmissiveScale } from './lighting.mjs';
import * as THREE from 'three';

function recordingCanvas() {
  const rects = [];
  const context = {
    fillStyle: '',
    clearRect() {
      rects.length = 0;
    },
    fillRect(...rect) {
      rects.push(rect);
    },
  };
  return { width: 0, height: 0, rects, getContext: () => context };
}

test('bóng đèn sáng đúng pha và bóng tắt vẫn còn màu mờ', () => {
  const green = signalBulbStyle('signal_a_bulb_green', { vehicle: 'green', pedestrian: 'stop' });
  const red = signalBulbStyle('signal_a_bulb_red', { vehicle: 'green', pedestrian: 'stop' });
  assert.equal(green.color, '#26ef65');
  assert.equal(green.intensity, EMISSIVE_SCALE.trafficSignal.default);
  assert.ok(red.intensity > 0 && red.intensity < green.intensity);
  assert.equal(
    signalBulbStyle('walk_a_go', { pedestrian: 'go' }).intensity,
    EMISSIVE_SCALE.trafficSignal.default,
  );
  assert.equal(signalBulbStyle('walk_a_stop', { pedestrian: 'go' }).intensity, red.intensity);
  assert.equal(signalBulbStyle('unknown', { vehicle: 'red' }), null);
});

test('hộp đếm ngược sáng ở mọi pha xe với màu của pha đang chạy', () => {
  const colours = { red: '#ff2a2a', yellow: '#ffb52a', green: '#26ef65' };
  for (const [vehicle, colour] of Object.entries(colours)) {
    const style = signalBulbStyle('signal_a_countdown', { vehicle, remaining: 7.2 });
    assert.equal(style.color, colour, vehicle);
    assert.equal(style.intensity, EMISSIVE_SCALE.trafficSignal.default, vehicle);
    assert.equal(style.digits, '8', vehicle);
  }
  const finished = signalBulbStyle('signal_a_countdown', { vehicle: 'red', remaining: 0 });
  assert.equal(finished.digits, '');
  assert.ok(finished.intensity < EMISSIVE_SCALE.trafficSignal.default);
});

test('số đếm ngược làm tròn lên theo giây và không quá hai chữ số', () => {
  assert.equal(countdownDigits(12.01), '13');
  assert.equal(countdownDigits(3), '3');
  assert.equal(countdownDigits(0.2), '1');
  assert.equal(countdownDigits(140), '99');
  assert.equal(countdownDigits(0), '');
  assert.equal(countdownDigits(-1), '');
  assert.equal(countdownDigits(undefined), '');
});

test('bảng đếm ngược vẽ số bằng các vạch bảy đoạn', () => {
  const canvas = recordingCanvas();
  const context = canvas.getContext('2d');
  paintCountdown(context, '18', 112, 160);
  assert.equal(canvas.rects.length, 2 + 7);
  paintCountdown(context, '0', 112, 160);
  assert.equal(canvas.rects.length, 6);
  paintCountdown(context, '', 112, 160);
  assert.equal(canvas.rects.length, 0);
  for (const [x, y, width, height] of canvas.rects) {
    assert.ok(x >= 0 && y >= 0 && x + width <= 112 && y + height <= 160);
  }
});

test('mặt LED đèn đường sáng màu trắng ấm theo thang streetLamp, không theo neon', () => {
  assert.deepEqual(STREET_LAMP_LED_NAMES, ['streetlight_a_led', 'streetlight_b_led']);
  for (const name of STREET_LAMP_LED_NAMES) {
    const style = streetLampStyle(name);
    assert.equal(style.color, '#ffe2b8');
    assert.equal(style.intensity, EMISSIVE_SCALE.streetLamp.default);
    assert.ok(isWithinEmissiveScale('streetLamp', style.intensity));
    assert.notEqual(style.intensity, EMISSIVE_SCALE.neon.default);
  }
  assert.equal(streetLampStyle('streetlight_a'), null);
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

test('hộp đếm ngược hiện số theo pha và giải phóng texture khi bỏ đèn', () => {
  const shared = new THREE.MeshBasicMaterial();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.016), shared);
  box.name = 'signal_a_countdown';
  const root = new THREE.Group();
  root.add(box);
  const canvas = recordingCanvas();
  const look = createSignalLook(THREE, root, { createCanvas: () => canvas });
  const digits = box.getObjectByName('signal_a_countdown_digits');
  assert.ok(digits, 'countdown digits plane');
  assert.ok(digits.position.z > 0.008);

  look.update({ vehicle: 'green', remaining: 4.5 });
  assert.equal(digits.visible, true);
  assert.equal(digits.userData.digits, '5');
  assert.equal(canvas.rects.length, 5);
  const green = new THREE.Color('#26ef65').multiplyScalar(EMISSIVE_SCALE.trafficSignal.default);
  assert.ok(digits.material.color.equals(green));
  assert.ok(box.material.emissive.equals(new THREE.Color('#000000')));
  assert.equal(box.material.emissiveIntensity, 0);
  assert.ok(
    box.material.color.r < 0.05 && box.material.color.g < 0.05 && box.material.color.b < 0.05,
  );

  look.update({ vehicle: 'red', remaining: 11 });
  assert.equal(digits.userData.digits, '11');
  const red = new THREE.Color('#ff2a2a').multiplyScalar(EMISSIVE_SCALE.trafficSignal.default);
  assert.ok(digits.material.color.equals(red));
  assert.ok(box.material.emissive.equals(new THREE.Color('#000000')));
  assert.equal(box.material.emissiveIntensity, 0);

  look.update({ vehicle: 'yellow', remaining: 0 });
  assert.equal(digits.visible, false);
  assert.ok(box.material.emissive.equals(new THREE.Color('#000000')));
  assert.equal(box.material.emissiveIntensity, 0);

  let disposed = 0;
  digits.material.map.addEventListener('dispose', () => disposed++);
  digits.material.addEventListener('dispose', () => disposed++);
  digits.geometry.addEventListener('dispose', () => disposed++);
  look.dispose();
  assert.equal(disposed, 3);
  assert.equal(box.getObjectByName('signal_a_countdown_digits'), undefined);
  box.geometry.dispose();
  shared.dispose();
});

test('đèn đường nhận vật liệu LED trắng ấm độc lập bảng màu và giải phóng đúng cách', () => {
  const expected = new THREE.Color('#ffe2b8').multiplyScalar(EMISSIVE_SCALE.streetLamp.default);
  for (const paletteBytes of [
    [168, 53, 255, 255],
    [41, 224, 216, 255],
  ]) {
    const paletteMap = new THREE.DataTexture(new Uint8Array(paletteBytes), 1, 1, THREE.RGBAFormat);
    const glow = new THREE.MeshBasicMaterial({ map: paletteMap, toneMapped: false });
    glow.color.setScalar(EMISSIVE_SCALE.neon.default);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(), glow);
    led.name = 'streetlight_b_led';
    const pole = new THREE.Mesh(new THREE.BoxGeometry(), glow);
    pole.name = 'streetlight_b';
    pole.add(led);
    const look = createStreetLampLook(THREE, pole);
    assert.notEqual(led.material, glow);
    assert.equal(pole.material, glow);
    assert.equal(led.material.map, null);
    assert.equal(led.material.toneMapped, false);
    assert.ok(led.material.color.equals(expected));
    assert.equal(glow.map, paletteMap);
    assert.equal(glow.color.r, EMISSIVE_SCALE.neon.default);
    let disposed = 0;
    led.material.addEventListener('dispose', () => disposed++);
    look.dispose();
    assert.equal(disposed, 1);
    led.geometry.dispose();
    pole.geometry.dispose();
    glow.dispose();
    paletteMap.dispose();
  }
});
