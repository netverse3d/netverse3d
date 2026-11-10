import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRecipes, loadConfig } from './lib.mjs';

const REAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = {
  palette: { surface: ['body', 'soft'], glow: ['strip', 'keycap'], images: ['display'] },
  kits: [
    {
      file: 'parts.glb',
      source: 'parts.blend',
      slots: { chair: { variants: ['a'], maxTriangles: 100 } },
    },
  ],
};

const RECIPE = {
  id: 'tim-neon',
  name: 'Tím Neon',
  palette: {
    body: ['#1a1428'],
    soft: ['#14101d'],
    strip: ['#a835ff'],
    keycap: ['#0aa0c8', '#c0189a'],
  },
  variants: { chair: 'a' },
  layout: {
    cells: [2, 2],
    stations: [{ cell: [0, 1], facing: 'south' }],
    door: { wall: 'south', at: 1 },
  },
  sign: { text: 'TÍM NEON', style: 'neon' },
  lighting: 'neon',
};

function rootWith(recipe, file = `${recipe.id}.json`) {
  const root = mkdtempSync(join(tmpdir(), 'recipes-'));
  mkdirSync(join(root, 'recipes'));
  writeFileSync(join(root, 'recipes', file), JSON.stringify(recipe));
  return root;
}

function errorsOf(overrides, file) {
  const recipe = { ...RECIPE, ...overrides };
  return checkRecipes(rootWith(recipe, file), CONFIG).join('\n');
}

test('công thức đúng hợp đồng thì đạt', () => {
  assert.equal(errorsOf({}), '');
});

test('công thức trỏ tới biến thể không tồn tại bị từ chối', () => {
  assert.match(errorsOf({ variants: { chair: 'z' } }), /tim-neon: slot chair has no variant z/);
});

test('công thức không chọn biến thể cho một ô bị từ chối', () => {
  assert.match(errorsOf({ variants: {} }), /tim-neon: no variant chosen for slot chair/);
});

test('công thức chọn ô không có trong bộ ô đồ bị từ chối', () => {
  assert.match(errorsOf({ variants: { chair: 'a', lamp: 'a' } }), /tim-neon: unknown slot lamp/);
});

test('công thức thiếu hoặc thừa hàng màu bị từ chối', () => {
  const { keycap, ...palette } = RECIPE.palette;
  assert.match(errorsOf({ palette }), /tim-neon: palette rows must be body, soft, strip, keycap/);
  assert.match(
    errorsOf({ palette: { ...RECIPE.palette, neon: ['#ffffff'] } }),
    /tim-neon: palette rows must be body, soft, strip, keycap/,
  );
});

test('màu không phải mã hex sáu chữ số bị từ chối', () => {
  assert.match(errorsOf({ palette: { ...RECIPE.palette, body: ['purple'] } }), /tim-neon: .*body/);
});

test('hai máy đặt cùng một ô bị từ chối', () => {
  const stations = [
    { cell: [0, 1], facing: 'south' },
    { cell: [0, 1], facing: 'north' },
  ];
  assert.match(
    errorsOf({ layout: { ...RECIPE.layout, stations } }),
    /tim-neon: two stations share cell 0,1/,
  );
});

test('máy đặt ngoài phòng bị từ chối', () => {
  const stations = [{ cell: [2, 0], facing: 'south' }];
  assert.match(
    errorsOf({ layout: { ...RECIPE.layout, stations } }),
    /tim-neon: station at 2,0 is outside the 2 x 2 room/,
  );
});

test('cửa đặt ngoài bức tường bị từ chối', () => {
  const door = { wall: 'south', at: 2 };
  assert.match(
    errorsOf({ layout: { ...RECIPE.layout, door } }),
    /tim-neon: door at 2 is outside the south wall/,
  );
});

test('kiểu đèn ngoài danh sách bị từ chối', () => {
  assert.match(errorsOf({ lighting: 'disco' }), /tim-neon: .*lighting/);
});

test('tên tệp công thức phải trùng với id', () => {
  assert.match(errorsOf({}, 'khac.json'), /khac\.json: id tim-neon does not match the file name/);
});

test('ba tiệm mẫu đúng hợp đồng công thức', () => {
  assert.deepEqual(checkRecipes(REAL_ROOT, loadConfig(REAL_ROOT)), []);
});

test('ba tiệm mẫu khác hẳn nhau về bộ màu', () => {
  const folder = join(REAL_ROOT, 'recipes');
  const recipes = readdirSync(folder).map((file) => JSON.parse(readFileSync(join(folder, file))));
  assert.equal(recipes.length, 3);
  for (const [index, first] of recipes.entries()) {
    for (const second of recipes.slice(index + 1)) {
      const shared = Object.keys(first.palette).filter(
        (row) => JSON.stringify(first.palette[row]) === JSON.stringify(second.palette[row]),
      );
      assert.ok(shared.length <= 2, `${first.id} và ${second.id} trùng hàng màu: ${shared}`);
      assert.notEqual(first.lighting, second.lighting);
    }
  }
});
