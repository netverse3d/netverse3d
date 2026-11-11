import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { FACE_H, FACE_W, createActorLook, wearsBackpack } from './actor-look.mjs';

function fakeCanvas(log) {
  const context = new Proxy(
    {},
    {
      get: (target, name) =>
        name in target
          ? target[name]
          : (...args) => {
              log.push([name, ...args]);
              return context;
            },
      set: (target, name, value) => {
        target[name] = value;
        return true;
      },
    },
  );
  return { width: 0, height: 0, getContext: () => context };
}

function actorWith(materialNames) {
  const root = new THREE.Group();
  for (const name of materialNames) {
    const material = new THREE.MeshStandardMaterial({ color: '#808080' });
    material.name = name;
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), material));
  }
  return root;
}

function lookWithLog() {
  const log = [];
  const canvases = [];
  const look = createActorLook(THREE, {
    createCanvas: () => {
      const canvas = fakeCanvas(log);
      canvases.push(canvas);
      return canvas;
    },
  });
  return { look, log, canvases };
}

test('sau khi mặc đồ, vật liệu face_canvas có texture mặt vẽ đúng cỡ', () => {
  const { look, canvases } = lookWithLog();
  const root = look.dress(actorWith(['face_canvas', 'skin']));
  const face = root.children[0].material;
  assert.ok(face.map instanceof THREE.CanvasTexture);
  assert.equal(face.map.image, canvases[0]);
  assert.deepEqual([canvases[0].width, canvases[0].height], [FACE_W, FACE_H]);
  assert.equal(root.userData.face, face);
});

test('sau khi mặc đồ, vật liệu logo_canvas có biểu tượng được vẽ', () => {
  const { look, log } = lookWithLog();
  const root = look.dress(actorWith(['logo_canvas']));
  const logo = root.children[0].material;
  assert.ok(logo.map instanceof THREE.CanvasTexture);
  assert.ok(log.some(([name]) => name === 'bezierCurveTo'));
  assert.equal(logo.transparent, true);
});

test('đổi biểu cảm thay texture mặt và dùng lại texture đã vẽ', () => {
  const { look, canvases } = lookWithLog();
  const root = look.dress(actorWith(['face_canvas']));
  assert.equal(look.showFace(root, 'laugh'), true);
  const laugh = root.userData.face.map;
  look.showFace(root, 'smile');
  look.showFace(root, 'laugh');
  assert.equal(root.userData.face.map, laugh);
  assert.equal(canvases.length, 2);
});

test('nhân vật không có mặt thì showFace báo không đổi được', () => {
  const { look } = lookWithLog();
  assert.equal(look.showFace(look.dress(actorWith(['skin'])), 'laugh'), false);
});

test('chất liệu mềm và chất liệu toon được nhớ riêng', () => {
  const { look } = lookWithLog();
  const source = { name: 'skin', color: new THREE.Color('#f7cda8'), roughness: 0.6, metalness: 0 };
  assert.equal(look.material(source, true), look.material(source, true));
  assert.ok(look.material(source, true) instanceof THREE.MeshStandardMaterial);
  assert.ok(look.material(source, false) instanceof THREE.MeshToonMaterial);
});

test('mặc đồ lần hai không tạo vật liệu mới', () => {
  const { look } = lookWithLog();
  const root = look.dress(actorWith(['face_canvas', 'skin']));
  const [face, skin] = root.children.map((mesh) => mesh.material);
  look.dress(root);
  assert.equal(root.children[0].material, face);
  assert.equal(root.children[1].material, skin);
});

test('nhân vật bỏ ba lô ở mọi hành động ngồi và đeo lại lúc đứng, đi, chạy', () => {
  for (const clip of ['sit_down', 'typing', 'sit_idle', 'stand_up']) {
    assert.equal(wearsBackpack(clip), false, clip);
  }
  for (const clip of ['idle', 'walk', 'run', 'wave', 'khong-co']) {
    assert.equal(wearsBackpack(clip), true, clip);
  }
});
