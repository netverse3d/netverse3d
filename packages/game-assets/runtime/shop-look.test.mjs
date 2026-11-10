import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isLfsPointer, loadConfig, readGlb } from '../tools/lib.mjs';
import {
  PALETTE_WIDTH,
  colorAt,
  drawCalls,
  instanceGroups,
  kitAnchors,
  paletteImage,
  paletteRows,
  shopPlan,
  stationPlan,
} from './shop-look.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = loadConfig(ROOT);
const ROWS = paletteRows(CONFIG.palette);

const SOCKETS = {
  socket_monitor: [0, 0.7, 0.62],
  socket_keyboard: [0, 0.7, 0.26],
  socket_mouse: [-0.29, 0.7, 0.26],
  socket_mat: [-0.04, 0.7, 0.27],
  socket_headset: [0.62, 0.7, 0.38],
  socket_mic: [-0.62, 0.7, 0.38],
  socket_speaker_left: [0.5, 0.7, 0.62],
  socket_speaker_right: [-0.5, 0.7, 0.62],
  socket_chair: [0, 0, -0.24],
  socket_case: [-0.46, 0, 0.36],
};

function fakeKit(variant = 'a') {
  const desk = `desk_${variant}`;
  const anchors = Object.entries(SOCKETS).map(([name, translation]) => ({
    name: `${desk}__${name}`,
    translation,
  }));
  const parts = [
    'monitor',
    'keyboard',
    'mouse',
    'mat',
    'headset',
    'mic',
    'speaker',
    'chair',
    'case',
  ];
  return {
    nodes: [
      { name: desk, mesh: 0, children: anchors.map((_, index) => index + 1) },
      ...anchors,
      ...parts.map((slot, index) => ({ name: `${slot}_a`, mesh: index + 1 })),
      { name: 'keyboard_b', mesh: 10 },
    ],
    meshes: [
      { primitives: [{ material: 0 }, { material: 1 }] },
      ...parts.map(() => ({ primitives: [{ material: 0 }] })),
      { primitives: [{ material: 0 }, { material: 1 }, { material: 2 }] },
    ],
  };
}

const VARIANTS = Object.fromEntries(
  ['desk', 'monitor', 'keyboard', 'mouse', 'mat', 'headset', 'mic', 'speaker', 'chair', 'case'].map(
    (slot) => [slot, 'a'],
  ),
);

function recipeWith(stations, cells = [2, 2]) {
  return {
    id: 'thu',
    variants: VARIANTS,
    layout: { cells, stations, door: { wall: 'south', at: 0 } },
  };
}

test('màu tại u giữa là nội suy tuyến tính rồi mới đưa về sRGB', () => {
  const [r, g, b] = colorAt(['#000000', '#ffffff'], 0.5);
  for (const channel of [r, g, b]) assert.ok(channel >= 187 && channel <= 188, `${channel}`);
});

test('hàng một màu cho cùng màu ở mọi u', () => {
  assert.deepEqual(colorAt(['#a835ff'], 0), [0xa8, 0x35, 0xff]);
  assert.deepEqual(colorAt(['#a835ff'], 1), [0xa8, 0x35, 0xff]);
});

test('dải nhiều màu đi qua đúng từng mốc', () => {
  const stops = ['#ff0000', '#00ff00', '#0000ff'];
  assert.deepEqual(colorAt(stops, 0), [255, 0, 0]);
  assert.deepEqual(colorAt(stops, 0.5), [0, 255, 0]);
  assert.deepEqual(colorAt(stops, 1), [0, 0, 255]);
});

test('ảnh dải màu có một hàng cho mỗi hàng màu của hợp đồng', () => {
  const image = paletteImage(ROWS, { body: ['#ffffff'] });
  assert.equal(image.width, PALETTE_WIDTH);
  assert.equal(image.height, 12);
  assert.equal(image.data.length, PALETTE_WIDTH * 12 * 4);
  assert.deepEqual([...image.data.slice(0, 4)], [255, 255, 255, 255]);
  const strip = ROWS.indexOf('strip') * PALETTE_WIDTH * 4;
  assert.deepEqual([...image.data.slice(strip, strip + 4)], [0, 0, 0, 255]);
});

test('đọc được socket và hộp va chạm từ tệp glTF', () => {
  const anchors = kitAnchors(fakeKit());
  assert.deepEqual(anchors.desk_a.socket_keyboard.position, SOCKETS.socket_keyboard);
});

test('đổi biến thể phím thì phím mới đặt đúng socket', () => {
  const plan = stationPlan({ ...VARIANTS, keyboard: 'b' }, kitAnchors(fakeKit()));
  const keyboard = plan.find((placement) => placement.slot === 'keyboard');
  assert.equal(keyboard.part, 'keyboard_b');
  assert.deepEqual(keyboard.position, SOCKETS.socket_keyboard);
});

test('hai loa dùng chung một hình khối ở hai socket', () => {
  const plan = stationPlan(VARIANTS, kitAnchors(fakeKit()));
  const speakers = plan.filter((placement) => placement.part === 'speaker_a');
  assert.deepEqual(
    speakers.map((placement) => placement.position),
    [SOCKETS.socket_speaker_left, SOCKETS.socket_speaker_right],
  );
});

test('bàn thiếu socket thì báo lỗi rõ', () => {
  const kit = fakeKit();
  kit.nodes = kit.nodes.filter((node) => node.name !== 'desk_a__socket_mic');
  assert.throws(() => stationPlan(VARIANTS, kitAnchors(kit)), /desk_a has no socket_mic/);
});

test('máy đứng giữa ô của nó và quay theo hướng người ngồi nhìn', () => {
  const anchors = kitAnchors(fakeKit());
  const plan = shopPlan(recipeWith([{ cell: [0, 0], facing: 'east' }]), anchors);
  const desk = plan.find((placement) => placement.slot === 'desk');
  assert.deepEqual(desk.position, [-1, 0, -1]);
  assert.equal(desk.yaw, Math.PI / 2);
  const south = shopPlan(recipeWith([{ cell: [1, 1], facing: 'south' }]), anchors);
  assert.equal(south.find((placement) => placement.slot === 'desk').yaw, 0);
});

test('50 máy cùng công thức không tăng số hình khối hay lời gọi vẽ', () => {
  const kit = fakeKit();
  const anchors = kitAnchors(kit);
  const one = shopPlan(recipeWith([{ cell: [0, 0], facing: 'south' }]), anchors);
  const stations = Array.from({ length: 50 }, (_, index) => ({
    cell: [index % 10, Math.floor(index / 10)],
    facing: 'south',
  }));
  const fifty = shopPlan(recipeWith(stations, [10, 6]), anchors);
  assert.equal(fifty.length, 50 * one.length);
  assert.equal(instanceGroups(fifty).size, instanceGroups(one).size);
  assert.equal(drawCalls(kit, fifty), drawCalls(kit, one));
  assert.equal(drawCalls(kit, one), 2 + 9);
});

test('bộ máy thật có đủ socket cho mọi ô trong công thức mẫu', (context) => {
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const anchors = kitAnchors(readGlb(buffer));
  const recipe = JSON.parse(readFileSync(join(ROOT, 'recipes', 'tim-neon.json'), 'utf8'));
  const plan = shopPlan(recipe, anchors);
  assert.equal(plan.length, recipe.layout.stations.length * 11);
});
