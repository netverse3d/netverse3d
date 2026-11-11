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
  socket_speaker_center: [0, 0.7, 0.5],
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
      { name: 'speaker_b', mesh: 7 },
      { name: 'speaker_b__mount_center', translation: [0, 0, 0] },
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

test('loa thanh chỉ lắp một chiếc ở giữa dưới màn hình, không lắp ở hai bên', () => {
  const plan = stationPlan({ ...VARIANTS, speaker: 'b' }, kitAnchors(fakeKit()));
  const speakers = plan.filter((placement) => placement.slot === 'speaker');
  assert.deepEqual(
    speakers.map((placement) => [placement.part, placement.position]),
    [['speaker_b', SOCKETS.socket_speaker_center]],
  );
  assert.equal(plan.length, 10);
});

test('bàn chưa có chỗ đặt loa thanh thì báo rõ thiếu socket nào', () => {
  const kit = fakeKit();
  kit.nodes = kit.nodes.filter((node) => node.name !== 'desk_a__socket_speaker_center');
  assert.throws(
    () => stationPlan({ ...VARIANTS, speaker: 'b' }, kitAnchors(kit)),
    /desk_a has no socket_speaker_center/,
  );
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

const ROOM_VARIANTS = {
  floor: 'a',
  wall: 'a',
  corner: 'a',
  door: 'a',
  window: 'a',
  ceiling: 'a',
  light: 'a',
};

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

test('phòng 2×2 có bốn sàn, bốn trần, ba góc, một cửa, một tường và hai đèn', () => {
  const plan = roomPlan(roomRecipe([2, 2], { wall: 'south', at: 0 }));
  assert.deepEqual(partsOf(plan), {
    floor_a: 4,
    ceiling_a: 4,
    corner_a: 3,
    door_a: 1,
    wall_a: 1,
    light_a: 2,
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
    assert.deepEqual(partsOf(plan), {
      floor_a: 3,
      ceiling_a: 3,
      door_a: 1,
      wall_a: 7,
      light_a: 2,
    });
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
  assert.equal(drawCalls(gltf, plan), 24);
});

function lightsOf(plan) {
  return plan
    .filter((placement) => placement.slot === 'light')
    .map((placement) => [...placement.position, placement.yaw]);
}

test('đèn trần nằm trên mối nối giữa hai ô trần kề nhau theo chiều ngang, sát trần', () => {
  const plan = roomPlan(roomRecipe([4, 3], { wall: 'south', at: 1 }));
  const lights = lightsOf(plan);
  assert.equal(lights.length, 9);
  assert.deepEqual(lights.slice(0, 3), [
    [-2, 3.47, -2, 0],
    [0, 3.47, -2, 0],
    [2, 3.47, -2, 0],
  ]);
  assert.ok(plan.filter((p) => p.slot === 'light').every((p) => p.part === 'light_a'));
});

test('phòng một ô rộng treo đèn dọc theo chiều dài phòng', () => {
  assert.deepEqual(lightsOf(roomPlan(roomRecipe([1, 3], { wall: 'south', at: 0 }))), [
    [0, 3.47, -1, Math.PI / 2],
    [0, 3.47, 1, Math.PI / 2],
  ]);
  assert.deepEqual(lightsOf(roomPlan(roomRecipe([3, 1], { wall: 'south', at: 0 }))), [
    [-1, 3.47, 0, 0],
    [1, 3.47, 0, 0],
  ]);
});

test('phòng một ô không có mối nối nên không có đèn trần', () => {
  assert.deepEqual(lightsOf(roomPlan(roomRecipe([1, 1], { wall: 'south', at: 0 }))), []);
});

test('đèn trần không chắn lối đi', () => {
  const plan = roomPlan(roomRecipe([3, 3], { wall: 'south', at: 1 }));
  assert.ok(lightsOf(plan).every(([, height]) => height > 2.5));
});

test('bộ máy khai ba mẫu thùng, mỗi mẫu có hộp va chạm vừa với khung ô và ba tiệm mẫu dùng ba mẫu khác nhau', (context) => {
  const config = loadConfig(ROOT);
  const slot = config.kits.find((kit) => kit.file === 'station-parts.glb').slots.case;
  assert.deepEqual(slot.variants, ['a', 'b', 'c']);
  const chosen = JSON.parse(readFileSync(join(ROOT, 'recipes', 'index.json'), 'utf8')).map(
    (id) => JSON.parse(readFileSync(join(ROOT, 'recipes', `${id}.json`), 'utf8')).variants.case,
  );
  assert.deepEqual([...chosen].sort(), ['a', 'b', 'c']);
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const anchors = kitAnchors(readGlb(buffer));
  const [width, height, depth] = slot.size;
  for (const variant of slot.variants) {
    const box = anchors[`case_${variant}`]?.collision_main;
    assert.ok(box, `case_${variant} has no collision box`);
    const [halfWidth, halfHeight, halfDepth] = box.scale;
    assert.ok(halfWidth * 2 <= width && halfDepth * 2 <= depth, `case_${variant} footprint`);
    assert.ok(Math.abs(box.position[1] - halfHeight) < 1e-4, `case_${variant} stands on the floor`);
    assert.ok(halfHeight * 2 <= height, `case_${variant} height`);
  }
});

const ROOM_HEIGHT = 3.6;
const COVE_FLOOR = 3.3;

function verticalSpan(gltf, part) {
  const node = gltf.nodes.find((candidate) => candidate.name === part);
  const spans = gltf.meshes[node.mesh].primitives.map(
    (primitive) => gltf.accessors[primitive.attributes.POSITION],
  );
  return [
    Math.min(...spans.map((accessor) => accessor.min[1])),
    Math.max(...spans.map((accessor) => accessor.max[1])),
  ];
}

test('tường, góc, cửa và cửa sổ của bộ phòng cao 3,6 m; dải hắt sáng của trần không thấp hơn 3,3 m', (context) => {
  const buffer = readFileSync(join(ROOT, 'exported', 'room-kit.glb'));
  if (isLfsPointer(buffer)) return context.skip('room-kit.glb chưa tải nội dung LFS');
  const gltf = readGlb(buffer);
  for (const part of ['wall_a', 'corner_a', 'door_a', 'window_a']) {
    const [, top] = verticalSpan(gltf, part);
    assert.ok(Math.abs(top - ROOM_HEIGHT) < 0.005, `${part} cao ${top.toFixed(3)} m`);
  }
  const [coveBottom, slabTop] = verticalSpan(gltf, 'ceiling_a');
  assert.ok(coveBottom >= COVE_FLOOR, `đáy dải hắt sáng ở ${coveBottom.toFixed(3)} m`);
  assert.ok(slabTop > ROOM_HEIGHT);
});

test('đèn trần treo dưới tấm trần và trên dải hắt sáng', () => {
  const plan = roomPlan(roomRecipe([3, 3], { wall: 'south', at: 1 }));
  for (const [, height] of lightsOf(plan)) {
    assert.ok(height > COVE_FLOOR && height < ROOM_HEIGHT, `đèn ở ${height} m`);
  }
});

test('ô tường của bộ phòng được khai cao tới 3,7 m trong danh mục', () => {
  const room = CONFIG.kits.find((kit) => kit.file === 'room-kit.glb');
  for (const slot of ['wall', 'corner', 'door', 'window']) {
    assert.equal(room.slots[slot].size[1], 3.7, slot);
  }
});

test('bộ máy khai ba mẫu ghế, mỗi mẫu có điểm ngồi và hộp va chạm vừa khung ô, ba tiệm mẫu dùng ba mẫu khác nhau', (context) => {
  const config = loadConfig(ROOT);
  const slot = config.kits.find((kit) => kit.file === 'station-parts.glb').slots.chair;
  assert.deepEqual(slot.variants, ['a', 'b', 'c']);
  const chosen = JSON.parse(readFileSync(join(ROOT, 'recipes', 'index.json'), 'utf8')).map(
    (id) => JSON.parse(readFileSync(join(ROOT, 'recipes', `${id}.json`), 'utf8')).variants.chair,
  );
  assert.deepEqual([...chosen].sort(), ['a', 'b', 'c']);
  const buffer = readFileSync(join(ROOT, 'exported', 'station-parts.glb'));
  if (isLfsPointer(buffer)) return context.skip('station-parts.glb chưa tải nội dung LFS');
  const anchors = kitAnchors(readGlb(buffer));
  const [width, height, depth] = slot.size;
  const seats = slot.variants.map((variant) => anchors[`chair_${variant}`]?.seat_anchor?.position);
  for (const variant of slot.variants) {
    const part = `chair_${variant}`;
    const box = anchors[part]?.collision_main;
    assert.ok(anchors[part]?.seat_anchor, `${part} has no seat anchor`);
    assert.ok(box, `${part} has no collision box`);
    const [halfWidth, halfHeight, halfDepth] = box.scale;
    assert.ok(halfWidth * 2 <= width && halfDepth * 2 <= depth, `${part} footprint`);
    assert.ok(halfHeight * 2 <= height, `${part} height`);
    assert.ok(Math.abs(box.position[1] - halfHeight) < 1e-4, `${part} stands on the floor`);
  }
  assert.deepEqual(seats[1], seats[0]);
  assert.deepEqual(seats[2], seats[0]);
});
