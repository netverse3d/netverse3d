import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ROOM_KIT,
  budgetUse,
  filterParts,
  partCount,
  partGroups,
  shopsUsing,
  withKeyboard,
} from '../library/shared/parts-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = {
  kits: [
    {
      file: 'station-parts.glb',
      slots: {
        desk: { variants: ['a', 'b'], maxTriangles: 2200, size: [1.7, 0.9, 0.8] },
        chair: { variants: ['a'], maxTriangles: 8000, size: [0.75, 1.4, 0.8] },
      },
    },
    {
      file: 'room-kit.glb',
      slots: { wall: { variants: ['a'], maxTriangles: 500, size: [2, 3, 2] } },
    },
    {
      file: 'lounge-parts.glb',
      slots: { sofa: { variants: ['a'], maxTriangles: 3000, size: [2, 1, 1] } },
    },
  ],
};

const RECIPES = {
  'tim-neon': { name: 'Tím Neon', variants: { desk: 'a', chair: 'a', sofa: 'a' } },
  'cam-retro': { name: 'Cam Retro', variants: { desk: 'b', chair: 'a', sofa: 'a' } },
};

test('danh mục món đồ gom theo bộ rồi theo ô, không lấy bộ module phòng', () => {
  const groups = partGroups(CONFIG);
  assert.deepEqual(
    groups.map((group) => group.kit),
    ['station-parts.glb', 'lounge-parts.glb'],
  );
  assert.equal(
    groups.some((group) => group.kit === ROOM_KIT),
    false,
  );
  assert.deepEqual(groups[0].slots[0], {
    slot: 'desk',
    maxTriangles: 2200,
    size: [1.7, 0.9, 0.8],
    parts: [
      { name: 'desk_a', slot: 'desk', variant: 'a', kit: 'station-parts.glb' },
      { name: 'desk_b', slot: 'desk', variant: 'b', kit: 'station-parts.glb' },
    ],
  });
  assert.equal(partCount(groups), 4);
});

test('cấu hình chưa có bộ nào thì danh mục rỗng, không sập', () => {
  assert.deepEqual(partGroups({}), []);
  assert.equal(partCount([]), 0);
});

test('lọc theo bộ chỉ giữ bộ đó; không chọn bộ thì giữ tất cả', () => {
  const groups = partGroups(CONFIG);
  assert.deepEqual(
    filterParts(groups, { kit: 'lounge-parts.glb', query: '' }).map((group) => group.kit),
    ['lounge-parts.glb'],
  );
  assert.equal(partCount(filterParts(groups, { kit: null, query: '' })), 4);
});

test('lọc theo chữ tìm trong tên món và tên ô, không phân biệt hoa thường và khoảng trắng thừa', () => {
  const groups = partGroups(CONFIG);
  const labels = { desk: 'Bàn', chair: 'Ghế', sofa: 'Sofa' };
  const names = (found) =>
    found.flatMap((group) => group.slots.flatMap((slot) => slot.parts.map((part) => part.name)));
  assert.deepEqual(names(filterParts(groups, { kit: null, query: ' DESK_b ' }, labels)), [
    'desk_b',
  ]);
  assert.deepEqual(names(filterParts(groups, { kit: null, query: 'ghế' }, labels)), ['chair_a']);
  assert.deepEqual(names(filterParts(groups, { kit: null, query: 'bàn' }, labels)), [
    'desk_a',
    'desk_b',
  ]);
  assert.deepEqual(filterParts(groups, { kit: null, query: 'không có món này' }, labels), []);
});

test('lọc xong thì ô nào hết món và bộ nào hết ô sẽ không còn tiêu đề trống', () => {
  const groups = partGroups(CONFIG);
  const found = filterParts(groups, { kit: null, query: 'sofa' }, { sofa: 'Sofa' });
  assert.equal(found.length, 1);
  assert.equal(found[0].slots.length, 1);
});

test('mức dùng ngân sách tam giác: thoải mái, sát trần, vượt trần', () => {
  assert.deepEqual(budgetUse(766, 2200), { ratio: 766 / 2200, level: 'ok' });
  assert.equal(budgetUse(1870, 2200).level, 'near');
  assert.equal(budgetUse(2200, 2200).level, 'near');
  assert.equal(budgetUse(2201, 2200).level, 'over');
  assert.equal(budgetUse(2201, 2200).ratio, 1);
  assert.deepEqual(budgetUse(10, 0), { ratio: 1, level: 'over' });
  assert.deepEqual(budgetUse(0, 0), { ratio: 0, level: 'ok' });
});

test('món đang được tiệm mẫu nào dùng thì ghi tên các tiệm đó, theo thứ tự tiệm', () => {
  const ids = ['tim-neon', 'cam-retro'];
  assert.deepEqual(shopsUsing(RECIPES, ids, 'desk', 'a'), ['Tím Neon']);
  assert.deepEqual(shopsUsing(RECIPES, ids, 'chair', 'a'), ['Tím Neon', 'Cam Retro']);
  assert.deepEqual(shopsUsing(RECIPES, ids, 'desk', 'z'), []);
  assert.deepEqual(shopsUsing(RECIPES, ['khong-co'], 'desk', 'a'), []);
});

test('đổi bộ màu phím hoặc LED tạo công thức mới, không sửa công thức gốc', () => {
  const recipe = { name: 'Tím Neon', keyboard: { colorway: 'neon', led: 'rainbow' } };
  const changed = withKeyboard(recipe, { colorway: 'retro' });
  assert.deepEqual(changed.keyboard, { colorway: 'retro', led: 'rainbow' });
  assert.deepEqual(recipe.keyboard, { colorway: 'neon', led: 'rainbow' });
  assert.deepEqual(withKeyboard({ name: 'x' }, { led: 'off' }).keyboard, { led: 'off' });
  assert.equal(withKeyboard(recipe, {}), recipe);
});

test('danh mục dựng từ cấu hình thật có đủ ba mẫu bàn và bộ góc console', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
  const groups = partGroups(config);
  const names = groups.flatMap((group) =>
    group.slots.flatMap((slot) => slot.parts.map((part) => part.name)),
  );
  for (const name of ['desk_a', 'desk_b', 'desk_c', 'mic_b', 'sofa_a']) {
    assert.ok(names.includes(name), name);
  }
  assert.equal(new Set(names).size, names.length);
  assert.equal(names.includes('wall_a'), false);
});
