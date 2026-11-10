import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib.mjs';
import { checkRecipes } from './recipes.mjs';

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

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function rootWithText(text, file) {
  const root = mkdtempSync(join(tmpdir(), 'recipes-'));
  roots.push(root);
  mkdirSync(join(root, 'recipes'));
  writeFileSync(join(root, 'recipes', file), text);
  return root;
}

function rootWith(recipe, file = `${recipe.id}.json`) {
  return rootWithText(JSON.stringify(recipe), file);
}

function errorsOf(overrides, file) {
  const recipe = { ...RECIPE, ...overrides };
  return checkRecipes(rootWith(recipe, file), CONFIG).join('\n');
}

test('tệp công thức không phải JSON được báo gọn thay vì sập', () => {
  const errors = checkRecipes(rootWithText('{oops', 'hong.json'), CONFIG).join('\n');
  assert.match(errors, /hong\.json: invalid JSON/);
});

test('tệp công thức chỉ chứa null bị từ chối theo hợp đồng', () => {
  const errors = checkRecipes(rootWithText('null', 'null.json'), CONFIG).join('\n');
  assert.match(errors, /null\.json: \/ must be object/);
});

test('dải phát sáng chỉ dành cho hàng bề mặt', () => {
  assert.equal(errorsOf({ emissive: { body: ['#201030'] } }), '');
  assert.match(
    errorsOf({ emissive: { strip: ['#201030'] } }),
    /tim-neon: emissive row strip is not a surface row/,
  );
});

test('công thức không có cửa bị từ chối', () => {
  const layout = { cells: RECIPE.layout.cells, stations: RECIPE.layout.stations };
  assert.match(errorsOf({ layout }), /tim-neon: \/layout must have required property 'door'/);
});

test('cửa và cửa sổ trùng chỗ bị từ chối', () => {
  const windows = [{ wall: 'south', at: 1 }];
  assert.match(
    errorsOf({ layout: { ...RECIPE.layout, windows } }),
    /tim-neon: two openings share south 1/,
  );
});

test('máy đặt ngay ô trước cửa bị từ chối', () => {
  const stations = [...RECIPE.layout.stations, { cell: [1, 1], facing: 'north' }];
  assert.match(
    errorsOf({ layout: { ...RECIPE.layout, stations } }),
    /tim-neon: station at 1,1 blocks the door/,
  );
});

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
  const palette = Object.fromEntries(
    Object.entries(RECIPE.palette).filter(([row]) => row !== 'keycap'),
  );
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
