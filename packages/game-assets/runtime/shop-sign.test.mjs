import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  buildSigns,
  contrastColor,
  paintSign,
  repaintSigns,
  signPlan,
  signStyle,
} from './shop-sign.mjs';

const PURPLE = {
  strip: ['#a835ff'],
  keycap: ['#0aa0c8', '#c0189a'],
  screen: ['#1f8fff', '#2a55ff'],
  accent: ['#8a2bff', '#c23cff'],
};
const TEAL = {
  strip: ['#1ee8d2'],
  keycap: ['#0fd4ff', '#19ffb0'],
  screen: ['#36c7ff', '#9af5ff'],
  accent: ['#22e0c0'],
};

function recipe(door, { cells = [4, 3], sign, palette = PURPLE, board = 'a' } = {}) {
  return {
    palette,
    variants: { sign: board, blade: 'a' },
    layout: { cells, door, stations: [], windows: [] },
    sign: sign ?? { text: 'TÍM NEON', style: 'neon' },
  };
}

function recordingContext() {
  const calls = [];
  const context = { calls };
  for (const name of ['fillRect', 'fillText', 'strokeText', 'clearRect']) {
    context[name] = (...args) => calls.push([name, ...args]);
  }
  return context;
}

function fakeCanvas() {
  const context = recordingContext();
  return { width: 0, height: 0, context, getContext: () => context };
}

function callsOf(canvas, name) {
  return canvas.context.calls.filter(([call]) => call === name);
}

function signKit() {
  const scene = new THREE.Group();
  for (const name of ['sign_a', 'sign_b', 'blade_a']) {
    const part = new THREE.Group();
    part.name = name;
    for (const materialName of ['surface', 'glow', 'decal']) {
      const material = new THREE.MeshBasicMaterial();
      material.name = materialName;
      part.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    }
    scene.add(part);
  }
  return scene;
}

function shopMaterials() {
  return Object.fromEntries(
    ['surface', 'glow', 'display', 'decal', 'legend'].map((name) => [
      name,
      new THREE.MeshBasicMaterial(),
    ]),
  );
}

test('màu chữ là màu trong bộ màu của tiệm lệch sắc nhiều nhất so với ống viền', () => {
  assert.equal(contrastColor(recipe({ wall: 'south', at: 1 })), '#0aa0c8');
});

test('tiệm chỉ có một tông màu thì chữ lấy màu đối của ống viền', () => {
  const color = contrastColor(recipe({ wall: 'south', at: 1 }, { palette: TEAL }));
  assert.equal(color, '#e81e34');
});

test('chữ neon có lõi sáng hơn màu ống; chữ sơn là màu nhạt không phát sáng', () => {
  const neon = signStyle(recipe({ wall: 'south', at: 1 }));
  assert.deepEqual(neon, { text: 'TÍM NEON', kind: 'neon', color: '#0aa0c8', core: '#c2e7f1' });
  const painted = signStyle(
    recipe({ wall: 'south', at: 1 }, { sign: { text: 'CAM RETRO', style: 'painted' } }),
  );
  assert.equal(painted.kind, 'painted');
  assert.equal(painted.color, '#b6e3ef');
  assert.equal(signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'X' } })).kind, 'neon');
});

test('chữ neon vẽ bằng nét viền: hai lượt ống có quầng rồi một lượt lõi mảnh', () => {
  const canvas = fakeCanvas();
  paintSign(canvas, signStyle(recipe({ wall: 'south', at: 1 })));
  assert.deepEqual([canvas.width, canvas.height], [1024, 256]);
  assert.deepEqual(callsOf(canvas, 'strokeText'), [
    ['strokeText', 'TÍM NEON', 512, 136],
    ['strokeText', 'TÍM NEON', 512, 136],
    ['strokeText', 'TÍM NEON', 512, 136],
  ]);
  assert.equal(callsOf(canvas, 'fillText').length, 0);
  assert.equal(canvas.context.strokeStyle, '#c2e7f1');
  assert.equal(canvas.context.lineWidth, 4);
});

test('chữ LED nằm trên nền đen và bị lưới chia thành các chấm sáng', () => {
  const canvas = fakeCanvas();
  paintSign(
    canvas,
    signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'BIỂN SÂU', style: 'led' } })),
  );
  assert.equal(callsOf(canvas, 'fillText').length, 2);
  assert.equal(callsOf(canvas, 'fillRect').length, 1 + 128 + 32);
  assert.deepEqual(callsOf(canvas, 'fillRect')[0], ['fillRect', 0, 0, 1024, 256]);
  assert.equal(canvas.context.calls[1][0], 'fillRect');
  assert.equal(canvas.context.fillStyle, '#04060a');
});

test('chữ sơn có bóng đổ lệch và không có quầng sáng', () => {
  const canvas = fakeCanvas();
  paintSign(
    canvas,
    signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'CAM RETRO', style: 'painted' } })),
  );
  assert.deepEqual(callsOf(canvas, 'fillText'), [
    ['fillText', 'CAM RETRO', 518, 142],
    ['fillText', 'CAM RETRO', 512, 136],
  ]);
  assert.equal(canvas.context.shadowBlur, 0);
});

test('tên tiệm dài thì cỡ chữ nhỏ lại để vừa mặt biển', () => {
  const short = fakeCanvas();
  const long = fakeCanvas();
  paintSign(short, signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'NET' } })));
  paintSign(
    long,
    signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'TIỆM NET SÀI GÒN CYBER 24' } })),
  );
  assert.equal(short.context.font, '800 176px "Be Vietnam Pro", sans-serif');
  assert.equal(long.context.font, '800 58px "Be Vietnam Pro", sans-serif');
});

test('mỗi tiệm có một biển trong tiệm, một biển mặt ngoài và một biển vẫy cạnh cửa', () => {
  const plan = signPlan(recipe({ wall: 'south', at: 1 }));
  assert.deepEqual(plan, [
    { slot: 'sign', part: 'sign_a', position: [-1, 2.85, 2.678], yaw: 0 },
    { slot: 'sign', part: 'sign_a', position: [-1, 2.95, 3.002], yaw: Math.PI },
    { slot: 'blade', part: 'blade_a', position: [-1.88, 2.5, 3.002], yaw: Math.PI },
  ]);
});

test('biển đi theo bức tường có cửa ở cả bốn hướng', () => {
  const inside = (door) => signPlan(recipe(door))[0];
  assert.deepEqual(inside({ wall: 'north', at: 2 }).position, [1, 2.85, -2.678]);
  assert.equal(inside({ wall: 'north', at: 2 }).yaw, Math.PI);
  assert.deepEqual(inside({ wall: 'east', at: 1 }).position, [3.678, 2.85, 0]);
  assert.equal(inside({ wall: 'east', at: 1 }).yaw, Math.PI / 2);
  assert.deepEqual(inside({ wall: 'west', at: 0 }).position, [-3.678, 2.85, -2]);
  assert.equal(inside({ wall: 'west', at: 0 }).yaw, -Math.PI / 2);
});

test('mẫu hộp biển lấy theo công thức của tiệm', () => {
  const plan = signPlan(recipe({ wall: 'south', at: 1 }, { board: 'b' }));
  assert.deepEqual(
    plan.map((placement) => placement.part),
    ['sign_b', 'sign_b', 'blade_a'],
  );
});

test('mọi biển của tiệm dùng chung một ảnh chữ, phần khung dùng vật liệu của tiệm', () => {
  const canvas = fakeCanvas();
  const materials = shopMaterials();
  const signs = buildSigns(THREE, signKit(), recipe({ wall: 'south', at: 1 }), materials, canvas);
  assert.equal(signs.name, 'shop_signs');
  const text = signs.children.filter((mesh) => mesh.material.name === 'sign_text');
  assert.equal(text.length, 2);
  assert.equal(text[0].count, 2);
  assert.equal(text[1].count, 1);
  assert.equal(text[0].material, text[1].material);
  assert.equal(text[0].material.map.image, canvas);
  assert.equal(text[0].material.map.flipY, false);
  assert.ok(signs.children.some((mesh) => mesh.material === materials.surface));
});

test('đổi tên tiệm thì vẽ lại chữ trên cùng tấm ảnh', () => {
  const canvas = fakeCanvas();
  const shop = recipe({ wall: 'south', at: 1 });
  const signs = buildSigns(THREE, signKit(), shop, shopMaterials(), canvas);
  const before = signs.userData.text.map.version;
  repaintSigns(signs, { ...shop, sign: { text: 'TÊN MỚI', style: 'neon' } });
  assert.equal(callsOf(canvas, 'strokeText').at(-1)[1], 'TÊN MỚI');
  assert.ok(signs.userData.text.map.version > before);
});

test('chữ đo ra rộng hơn mặt biển thì thu cỡ lại cho vừa, không bị cắt chữ cuối', () => {
  const canvas = fakeCanvas();
  canvas.context.measureText = () => ({ width: 1175 });
  paintSign(canvas, signStyle(recipe({ wall: 'south', at: 1 }, { sign: { text: 'CAM RETRO' } })));
  assert.equal(canvas.context.font, '800 130px "Be Vietnam Pro", sans-serif');
});

test('biển trong tiệm treo cao hơn đầu nhân vật và thấp hơn dải hắt sáng của trần', () => {
  const [inside] = signPlan(recipe({ wall: 'south', at: 1 }));
  const halfBoard = 0.26;
  assert.ok(inside.position[1] - halfBoard >= 2.5, 'đáy biển từ 2,5 m');
  assert.ok(inside.position[1] + halfBoard <= 3.3, 'đỉnh biển dưới dải hắt sáng');
});
