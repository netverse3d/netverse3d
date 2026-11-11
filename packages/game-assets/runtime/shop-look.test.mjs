import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isLfsPointer, loadConfig, readGlb } from '../tools/lib.mjs';
import {
  PALETTE_WIDTH,
  colorAt,
  doorwayCell,
  drawCalls,
  instanceGroups,
  kitAnchors,
  paletteImage,
  paletteRows,
  roomPlan,
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

test('đọc được socket từ tệp glTF và bỏ qua node lưới trùng kiểu tên', () => {
  const kit = fakeKit();
  kit.nodes.push({ name: 'desk_a__socket_fake', mesh: 0 });
  const anchors = kitAnchors(kit);
  assert.deepEqual(anchors.desk_a.socket_keyboard.position, SOCKETS.socket_keyboard);
  assert.equal(anchors.desk_a.socket_fake, undefined);
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
  const monitor = plan.find((placement) => placement.slot === 'monitor');
  assert.deepEqual(monitor.position, [-0.38, 0.7, -1]);
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

const ROOM_VARIANTS = { floor: 'a', wall: 'a', corner: 'a', door: 'a', window: 'a', ceiling: 'a' };

function roomRecipe(cells, door, windows = []) {
  return {
    variants: { ...VARIANTS, ...ROOM_VARIANTS },
    layout: { cells, stations: [], door, windows },
  };
}

function partsOf(plan) {
  return Object.fromEntries(
    [...instanceGroups(plan)].map(([part, placements]) => [part, placements.length]),
  );
}

function placementAt(plan, slot, position) {
  return plan.find((p) => p.slot === slot && p.position.join(',') === position.join(','));
}

test('phòng 2×2 có bốn sàn, bốn trần, ba góc, một cửa và một tường', () => {
  const plan = roomPlan(roomRecipe([2, 2], { wall: 'south', at: 0 }));
  assert.deepEqual(partsOf(plan), {
    floor_a: 4,
    ceiling_a: 4,
    corner_a: 3,
    door_a: 1,
    wall_a: 1,
  });
});

test('tường và góc quay mặt vào trong theo từng cạnh', () => {
  const plan = roomPlan(roomRecipe([3, 3], { wall: 'south', at: 1 }));
  assert.equal(placementAt(plan, 'door', [0, 0, 2]).yaw, 0);
  assert.equal(placementAt(plan, 'wall', [0, 0, -2]).yaw, Math.PI);
  assert.equal(placementAt(plan, 'wall', [-2, 0, 0]).yaw, -Math.PI / 2);
  assert.equal(placementAt(plan, 'wall', [2, 0, 0]).yaw, Math.PI / 2);
  assert.equal(placementAt(plan, 'corner', [-2, 0, 2]).yaw, 0);
  assert.equal(placementAt(plan, 'corner', [2, 0, 2]).yaw, Math.PI / 2);
  assert.equal(placementAt(plan, 'corner', [2, 0, -2]).yaw, Math.PI);
  assert.equal(placementAt(plan, 'corner', [-2, 0, -2]).yaw, -Math.PI / 2);
});

test('cửa sổ thay tường ở đúng vị trí của nó', () => {
  const plan = roomPlan(roomRecipe([3, 3], { wall: 'south', at: 1 }, [{ wall: 'north', at: 1 }]));
  assert.equal(placementAt(plan, 'window', [0, 0, -2]).yaw, Math.PI);
  assert.equal(placementAt(plan, 'wall', [0, 0, -2]), undefined);
});

test('cửa ở ô góc thì ô đó có cửa và một tường thay cho góc', () => {
  const plan = roomPlan(roomRecipe([2, 2], { wall: 'south', at: 1 }));
  assert.equal(placementAt(plan, 'door', [1, 0, 1]).yaw, 0);
  assert.equal(placementAt(plan, 'wall', [1, 0, 1]).yaw, Math.PI / 2);
  assert.equal(placementAt(plan, 'corner', [1, 0, 1]), undefined);
});

test('phòng một ô rộng không có góc, hai tường đối diện đứng riêng', () => {
  for (const cells of [
    [1, 3],
    [3, 1],
  ]) {
    const plan = roomPlan(roomRecipe(cells, { wall: 'south', at: 0 }));
    assert.deepEqual(partsOf(plan), { floor_a: 3, ceiling_a: 3, door_a: 1, wall_a: 7 });
    assert.ok(plan.every((placement) => Number.isFinite(placement.yaw)));
  }
});

test('ô sàn ngay trong cửa tính theo từng tường', () => {
  const cells = [3, 4];
  assert.deepEqual(doorwayCell({ wall: 'north', at: 1 }, cells), [1, 0]);
  assert.deepEqual(doorwayCell({ wall: 'south', at: 1 }, cells), [1, 3]);
  assert.deepEqual(doorwayCell({ wall: 'west', at: 2 }, cells), [0, 2]);
  assert.deepEqual(doorwayCell({ wall: 'east', at: 2 }, cells), [2, 2]);
});

test('bộ máy thật có đủ socket cho mọi ô trong công thức mẫu', (context) => {
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const gltf = readGlb(buffer);
  const recipe = JSON.parse(readFileSync(join(ROOT, 'recipes', 'tim-neon.json'), 'utf8'));
  const plan = shopPlan(recipe, kitAnchors(gltf));
  assert.equal(plan.length, recipe.layout.stations.length * 11);
  assert.equal(drawCalls(gltf, plan), 25);
});
