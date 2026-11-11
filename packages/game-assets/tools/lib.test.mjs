import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { PREVIEW_SUFFIX } from '../runtime/three-shop.mjs';
import {
  buildStamp,
  checkAssets,
  checkModel,
  checkStamp,
  previewImages,
  contentId,
  finishExport,
  isLfsPointer,
  readGlb,
  stampPath,
} from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function makeGlb(gltf, bin) {
  const json = Buffer.from(JSON.stringify(gltf).padEnd(4, ' '));
  const padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const binChunk = bin ? Buffer.alloc(8 + bin.length) : Buffer.alloc(0);
  if (bin) {
    binChunk.writeUInt32LE(bin.length, 0);
    binChunk.writeUInt32LE(0x004e4942, 4);
    bin.copy(binChunk, 8);
  }
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binChunk.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, padded, binChunk]);
}

function makeModel(overrides = {}) {
  return {
    nodes: [{ name: 'hips' }, { name: 'head' }, { name: 'body', mesh: 0, skin: 0 }],
    skins: [{ joints: [0, 1] }],
    meshes: [
      { primitives: [{ indices: 0, material: 0, attributes: { JOINTS_0: 1, WEIGHTS_0: 2 } }] },
    ],
    accessors: [{ count: 300 }],
    materials: [{ name: 'skin' }],
    animations: [{ name: 'idle', channels: [{ target: { node: 0 } }] }],
    ...overrides,
  };
}

const EXPECTED = { meshes: { body: 100 }, bones: ['hips', 'head'], clips: ['idle'] };

function pointerFor(buffer) {
  const oid = createHash('sha256').update(buffer).digest('hex');
  return Buffer.from(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${oid}\nsize ${buffer.length}\n`,
  );
}

function makeRoot(sourceContent = Buffer.from('source')) {
  const root = mkdtempSync(join(tmpdir(), 'game-assets-'));
  mkdirSync(join(root, 'source'));
  mkdirSync(join(root, 'exported'));
  const config = {
    bones: ['hips', 'head'],
    clips: ['idle'],
    character: {
      file: 'player.glb',
      lodFile: 'player-lod.glb',
      rigSource: 'base.blend',
      clipSource: 'base.blend',
      meshes: { body: { source: 'base.blend', maxTriangles: 100, lodTriangles: 100 } },
    },
    props: [],
  };
  writeFileSync(join(root, 'assets.config.json'), JSON.stringify(config));
  writeFileSync(join(root, 'source/base.blend'), sourceContent);
  writeFileSync(join(root, 'exported/player.glb'), makeGlb(makeModel()));
  writeFileSync(join(root, 'exported/player-lod.glb'), makeGlb(makeModel({ animations: [] })));
  writeFileSync(join(root, 'exported/export-stamp.json'), JSON.stringify(buildStamp(root, config)));
  return { root, config };
}

test('đọc phần JSON của tệp GLB', () => {
  assert.equal(readGlb(makeGlb(makeModel())).nodes[2].name, 'body');
});

test('từ chối tệp không phải GLB', () => {
  assert.throws(() => readGlb(Buffer.alloc(32)), /not a GLB/);
});

test('mô hình đúng hợp đồng thì không có lỗi', () => {
  assert.deepEqual(checkModel('a.glb', makeModel(), EXPECTED), []);
});

test('báo node lưới có scale chưa áp dụng', () => {
  const nodes = [
    { name: 'hips' },
    { name: 'head' },
    { name: 'body', mesh: 0, skin: 0, scale: [2, 2, 2] },
  ];
  assert.match(
    checkModel('a.glb', makeModel({ nodes }), EXPECTED).join('\n'),
    /body has an unapplied transform/,
  );
});

test('báo node lưới có góc xoay chưa áp dụng', () => {
  const nodes = [
    { name: 'hips' },
    { name: 'head' },
    { name: 'body', mesh: 0, skin: 0, rotation: [0, 0.7, 0, 0.7] },
  ];
  assert.match(
    checkModel('a.glb', makeModel({ nodes }), EXPECTED).join('\n'),
    /body has an unapplied transform/,
  );
});

test('báo node lưới có ma trận chưa áp dụng', () => {
  const nodes = [
    { name: 'hips' },
    { name: 'head' },
    { name: 'body', mesh: 0, skin: 0, matrix: [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
  ];
  assert.match(
    checkModel('a.glb', makeModel({ nodes }), EXPECTED).join('\n'),
    /body has an unapplied transform/,
  );
});

test('xương được phép có transform riêng', () => {
  const nodes = [
    { name: 'hips', translation: [0, 0.7, 0], rotation: [0, 0.7, 0, 0.7] },
    { name: 'head' },
    { name: 'body', mesh: 0, skin: 0 },
  ];
  assert.deepEqual(checkModel('a.glb', makeModel({ nodes }), EXPECTED), []);
});

test('báo thiếu xương so với bộ xương chung', () => {
  const errors = checkModel('a.glb', makeModel({ skins: [{ joints: [0] }] }), EXPECTED);
  assert.match(errors.join('\n'), /missing bone: head/);
});

test('báo xương lạ ngoài bộ xương chung', () => {
  const nodes = [...makeModel().nodes, { name: 'tail' }];
  const errors = checkModel(
    'a.glb',
    makeModel({ nodes, skins: [{ joints: [0, 1, 3] }] }),
    EXPECTED,
  );
  assert.match(errors.join('\n'), /unexpected bone: tail/);
});

test('báo thiếu clip chuyển động', () => {
  const errors = checkModel('a.glb', makeModel({ animations: [] }), EXPECTED);
  assert.match(errors.join('\n'), /missing clip: idle/);
});

test('báo clip không có kênh chuyển động', () => {
  const animations = [{ name: 'idle', channels: [] }];
  const errors = checkModel('a.glb', makeModel({ animations }), EXPECTED);
  assert.match(errors.join('\n'), /clip idle has no channels/);
});

test('báo mesh vượt ngân sách tam giác', () => {
  const errors = checkModel('a.glb', makeModel({ accessors: [{ count: 303 }] }), EXPECTED);
  assert.match(errors.join('\n'), /body has 101 triangles, limit 100/);
});

test('báo thiếu mesh và mesh chưa khai', () => {
  const nodes = [{ name: 'hips' }, { name: 'head' }, { name: 'tail', mesh: 0, skin: 0 }];
  const text = checkModel('a.glb', makeModel({ nodes }), EXPECTED).join('\n');
  assert.match(text, /missing mesh: body/);
  assert.match(text, /unexpected mesh: tail/);
});

test('báo mesh chưa gắn vào bộ xương', () => {
  const nodes = [{ name: 'hips' }, { name: 'head' }, { name: 'body', mesh: 0 }];
  const errors = checkModel('a.glb', makeModel({ nodes }), EXPECTED);
  assert.match(errors.join('\n'), /body is not skinned/);
});

test('báo vật liệu bị nhân bản khi ghép tệp', () => {
  const errors = checkModel('a.glb', makeModel({ materials: [{ name: 'skin.001' }] }), EXPECTED);
  assert.match(errors.join('\n'), /duplicated material: skin\.001/);
});

test('mã nội dung của con trỏ LFS trùng với mã của tệp thật', () => {
  const real = Buffer.from('blender bytes');
  const pointer = pointerFor(real);
  assert.equal(isLfsPointer(pointer), true);
  assert.equal(isLfsPointer(real), false);
  assert.equal(contentId(pointer), contentId(real));
});

test('dấu xuất khớp khi tệp gốc chưa đổi', () => {
  const { root, config } = makeRoot();
  assert.deepEqual(checkStamp(root, config), []);
});

test('báo quên xuất lại khi tệp gốc đã đổi', () => {
  const { root, config } = makeRoot();
  writeFileSync(join(root, 'source/base.blend'), 'edited');
  assert.match(checkStamp(root, config).join('\n'), /base\.blend changed since the last export/);
});

test('báo tệp xuất bị sửa ngoài lệnh xuất', () => {
  const { root, config } = makeRoot();
  writeFileSync(join(root, 'exported/player.glb'), makeGlb(makeModel({ animations: [] })));
  assert.match(checkStamp(root, config).join('\n'), /player\.glb does not match the last export/);
});

test('báo tệp gốc chưa khai trong cấu hình', () => {
  const { root, config } = makeRoot();
  writeFileSync(join(root, 'source/extra.blend'), 'extra');
  assert.match(checkStamp(root, config).join('\n'), /extra\.blend is not declared/);
});

test('tệp xuất chỉ là con trỏ LFS thì ghi nhận bỏ qua phần nội dung', () => {
  const { root } = makeRoot();
  writeFileSync(join(root, 'exported/player.glb'), pointerFor(makeGlb(makeModel())));
  const report = checkAssets(root);
  assert.deepEqual(report.errors, []);
  assert.match(report.skipped.join('\n'), /player\.glb/);
});

test('chế độ bắt buộc nội dung coi con trỏ LFS là lỗi', () => {
  const { root } = makeRoot();
  writeFileSync(join(root, 'exported/player.glb'), pointerFor(makeGlb(makeModel())));
  assert.match(checkAssets(root, { requireContent: true }).errors.join('\n'), /LFS pointer/);
});

test('bộ tệp đúng hợp đồng thì không có lỗi và không bỏ qua gì', () => {
  const { root } = makeRoot();
  assert.deepEqual(checkAssets(root, { requireContent: true }), { errors: [], skipped: [] });
});

test('báo mesh thiếu lớp màu bắt buộc', () => {
  const expected = { ...EXPECTED, attributes: { body: ['COLOR_0'] } };
  assert.match(
    checkModel('a.glb', makeModel(), expected).join('\n'),
    /body is missing attribute COLOR_0/,
  );
});

test('báo tệp xuất đã khai nhưng chưa từng được xuất', () => {
  const { root, config } = makeRoot();
  config.props.push({ file: 'chair.glb', source: 'base.blend', object: 'chair', maxTriangles: 9 });
  writeFileSync(join(root, 'assets.config.json'), JSON.stringify(config));
  const text = checkAssets(root, { requireContent: true }).errors.join('\n');
  assert.match(text, /chair\.glb is not in the export stamp/);
  assert.match(text, /chair\.glb is missing/);
});

test('báo tệp gốc đã khai nhưng chưa có trong dấu xuất', () => {
  const { root, config } = makeRoot();
  writeFileSync(join(root, 'source/hair.blend'), 'hair');
  config.character.meshes.hair = { source: 'hair.blend', maxTriangles: 9 };
  assert.match(checkStamp(root, config).join('\n'), /hair\.blend is not in the export stamp/);
});

test('không ghi dấu xuất khi mô hình sai hợp đồng', () => {
  const { root, config } = makeRoot();
  const before = readFileSync(stampPath(root), 'utf8');
  writeFileSync(join(root, 'exported/player.glb'), makeGlb(makeModel({ animations: [] })));
  assert.match(finishExport(root).join('\n'), /missing clip: idle/);
  assert.equal(readFileSync(stampPath(root), 'utf8'), before);
  assert.match(checkStamp(root, config).join('\n'), /player\.glb does not match/);
});

test('báo cấu hình đã đổi sau lần xuất cuối', () => {
  const { root, config } = makeRoot();
  config.character.meshes.body.maxTriangles = 50;
  writeFileSync(join(root, 'assets.config.json'), JSON.stringify(config));
  assert.match(
    checkStamp(root, config).join('\n'),
    /assets\.config\.json changed since the last export/,
  );
});

test('lệnh xuất dừng khi có tệp gốc chưa khai', () => {
  const { root } = makeRoot();
  const before = readFileSync(stampPath(root), 'utf8');
  writeFileSync(join(root, 'source/extra.blend'), 'extra');
  assert.match(finishExport(root).join('\n'), /extra\.blend is not declared/);
  assert.equal(readFileSync(stampPath(root), 'utf8'), before);
});

const PALETTE = {
  surface: ['body', 'soft'],
  glow: ['strip', 'keycap'],
  images: ['display', 'decal'],
};

function uvBuffer(u, v) {
  const bin = Buffer.alloc(8);
  bin.writeFloatLE(u, 0);
  bin.writeFloatLE(v, 4);
  return bin;
}

function makeKitModel(overrides = {}) {
  return {
    nodes: [
      { name: 'chair_a', mesh: 0, children: [1] },
      { name: 'chair_a__seat_anchor', translation: [0, 0.4, 0] },
    ],
    meshes: [
      { primitives: [{ indices: 0, material: 0, attributes: { POSITION: 1, TEXCOORD_0: 2 } }] },
    ],
    accessors: [
      { count: 3 },
      { count: 3, min: [-0.1, 0, -0.1], max: [0.1, 0.5, 0.1] },
      { count: 1, bufferView: 0, componentType: 5126, type: 'VEC2' },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }],
    materials: [{ name: 'surface' }],
    ...overrides,
  };
}

function makeKitRoot(model, slotOverrides = {}, configOverrides = {}, bin = uvBuffer(0.5, 0.375)) {
  const { root, config } = makeRoot();
  const kit = {
    file: 'parts.glb',
    source: 'parts.blend',
    slots: {
      chair: { variants: ['a'], maxTriangles: 100, anchors: ['seat_anchor'], ...slotOverrides },
    },
  };
  writeFileSync(
    join(root, 'assets.config.json'),
    JSON.stringify({ ...config, kits: [kit], palette: PALETTE, ...configOverrides }),
  );
  writeFileSync(join(root, 'source/parts.blend'), 'parts');
  writeFileSync(join(root, 'exported/parts.glb'), makeGlb(model, bin));
  return root;
}

test('ô đồ đủ điểm gắn thì được ghi dấu xuất', () => {
  assert.deepEqual(finishExport(makeKitRoot(makeKitModel())), []);
});

const LIGHTMAP_KIT = {
  kits: [
    {
      file: 'parts.glb',
      source: 'parts.blend',
      lightmap: true,
      slots: { chair: { variants: ['a'], maxTriangles: 100, anchors: ['seat_anchor'] } },
    },
  ],
};

function litKitModel(texCoord) {
  return makeKitModel({
    meshes: [
      {
        primitives: [
          { indices: 0, material: 0, attributes: { POSITION: 1, TEXCOORD_0: 2, TEXCOORD_1: 2 } },
        ],
      },
    ],
    materials: [{ name: 'surface', occlusionTexture: { index: 0, texCoord } }],
    textures: [{ source: 0 }],
    images: [{ mimeType: 'image/png', bufferView: 0 }],
  });
}

test('bộ ô đồ khai lightmap mà thiếu UV thứ hai và ảnh che khuất bị từ chối', () => {
  const errors = finishExport(makeKitRoot(makeKitModel(), {}, LIGHTMAP_KIT)).join('\n');
  assert.match(errors, /chair_a is missing attribute TEXCOORD_1/);
  assert.match(errors, /surface material has no baked occlusion texture/);
});

test('ảnh che khuất phải nằm trên UV thứ hai', () => {
  const errors = finishExport(makeKitRoot(litKitModel(0), {}, LIGHTMAP_KIT)).join('\n');
  assert.match(errors, /surface occlusion must use UV set 1/);
});

test('bộ ô đồ có lightmap đúng chỗ thì được ghi dấu xuất', () => {
  assert.deepEqual(finishExport(makeKitRoot(litKitModel(1), {}, LIGHTMAP_KIT)), []);
});

const SCENE = {
  id: 'showcase',
  source: 'showcase.blend',
  file: 'showcase.glb',
  recipe: 'tim-neon',
  images: { base: 'showcase-base', spill: 'showcase-spill' },
  files: { base: 'showcase-base.jpg', spill: 'showcase-spill.jpg' },
};

function makeSceneRoot(model, { images = true } = {}) {
  const { root, config } = makeRoot();
  writeFileSync(
    join(root, 'assets.config.json'),
    JSON.stringify({ ...config, palette: PALETTE, scenes: [SCENE] }),
  );
  writeFileSync(join(root, 'source/showcase.blend'), 'showcase');
  writeFileSync(join(root, 'exported/showcase.glb'), makeGlb(model, uvBuffer(0.5, 0.375)));
  if (images) {
    for (const file of Object.values(SCENE.files))
      writeFileSync(join(root, 'exported', file), 'jpg');
  }
  return root;
}

test('cảnh giới thiệu thiếu UV thứ hai hay thiếu ảnh bake bị từ chối', () => {
  const model = makeKitModel({ nodes: [{ name: 'wall_a_01', mesh: 0 }] });
  const errors = finishExport(makeSceneRoot(model, { images: false })).join('\n');
  assert.match(errors, /showcase\.glb: wall_a_01 is missing attribute TEXCOORD_1/);
  assert.match(errors, /showcase\.glb: baked image showcase-base\.jpg is missing/);
});

test('cảnh giới thiệu đủ UV và ảnh bake thì được ghi dấu xuất cùng hai ảnh', () => {
  const model = makeKitModel({
    nodes: [{ name: 'wall_a_01', mesh: 0 }],
    meshes: [
      {
        primitives: [
          { indices: 0, material: 0, attributes: { POSITION: 1, TEXCOORD_0: 2, TEXCOORD_1: 2 } },
        ],
      },
    ],
  });
  const root = makeSceneRoot(model);
  assert.deepEqual(finishExport(root), []);
  const stamp = JSON.parse(readFileSync(stampPath(root), 'utf8'));
  assert.ok(stamp.exported['showcase-base.jpg']);
  assert.ok(stamp.exported['showcase-spill.jpg']);
  assert.ok(stamp.sources['showcase.blend']);
});

test('báo ghế thiếu điểm ngồi', () => {
  const nodes = [{ name: 'chair_a', mesh: 0 }];
  const errors = finishExport(makeKitRoot(makeKitModel({ nodes })));
  assert.match(errors.join('\n'), /chair_a is missing anchor seat_anchor/);
});

test('báo điểm gắn là lưới thay vì Empty', () => {
  const model = makeKitModel({
    nodes: [
      { name: 'chair_a', mesh: 0, children: [1] },
      { name: 'chair_a__seat_anchor', mesh: 0 },
    ],
  });
  const errors = finishExport(makeKitRoot(model));
  assert.match(errors.join('\n'), /chair_a anchor seat_anchor must be an empty, not a mesh/);
});

test('báo hộp va chạm không có kích thước', () => {
  const model = makeKitModel({
    nodes: [
      { name: 'chair_a', mesh: 0, children: [1] },
      { name: 'chair_a__collision_main', scale: [0.3, 0, 0.3] },
    ],
  });
  const errors = finishExport(makeKitRoot(model, { anchors: ['collision_main'] }));
  assert.match(errors.join('\n'), /chair_a anchor collision_main has no size/);
});

test('báo lưới kế thừa transform từ Empty cha', () => {
  const model = makeKitModel({
    nodes: [
      { name: 'rig_root', scale: [3, 3, 3], children: [1] },
      { name: 'chair_a', mesh: 0, children: [2] },
      { name: 'chair_a__seat_anchor' },
    ],
  });
  const errors = finishExport(makeKitRoot(model));
  assert.match(errors.join('\n'), /chair_a inherits an unapplied transform from rig_root/);
});

test('báo thiếu biến thể đã khai trong cấu hình', () => {
  const errors = finishExport(makeKitRoot(makeKitModel(), { variants: ['a', 'b'] }));
  assert.match(errors.join('\n'), /missing mesh: chair_b/);
});

test('báo cấu hình có ô đồ mà thiếu bộ màu', () => {
  const errors = finishExport(makeKitRoot(makeKitModel(), {}, { palette: undefined }));
  assert.match(errors.join('\n'), /kits need a palette in the config/);
});

test('báo mặt không có vật liệu', () => {
  const model = makeKitModel({
    meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1, TEXCOORD_0: 2 } }] }],
  });
  const errors = finishExport(makeKitRoot(model));
  assert.match(errors.join('\n'), /chair_a has a primitive without a material/);
});

function makePaletteModel(u, v, material = 'surface') {
  return { model: makeKitModel({ materials: [{ name: material }] }), bin: uvBuffer(u, v) };
}

function finishPaletteExport({ model, bin }) {
  return finishExport(makeKitRoot(model, {}, {}, bin)).join('\n');
}

test('bề mặt trỏ đúng hàng màu của nó thì đạt', () => {
  assert.equal(finishPaletteExport(makePaletteModel(0.5, 0.375)), '');
});

test('phím phát sáng trỏ đúng hàng màu phát sáng thì đạt', () => {
  assert.equal(finishPaletteExport(makePaletteModel(0.9, 0.875, 'glow')), '');
});

test('báo vật liệu nằm ngoài hợp đồng bộ màu', () => {
  assert.match(
    finishPaletteExport(makePaletteModel(0.5, 0.375, 'prop_dark')),
    /uses material prop_dark outside the palette/,
  );
});

test('báo ô đồ không có UV trỏ vào dải màu', () => {
  const { model, bin } = makePaletteModel(0.5, 0.375);
  model.meshes[0].primitives[0].attributes = { POSITION: 1 };
  assert.match(finishPaletteExport({ model, bin }), /has no palette UV/);
});

test('báo bề mặt trỏ nhầm sang hàng màu phát sáng', () => {
  assert.match(
    finishPaletteExport(makePaletteModel(0.5, 0.625)),
    /palette UV outside surface rows/,
  );
});

test('báo UV nằm giữa hai hàng màu', () => {
  assert.match(finishPaletteExport(makePaletteModel(0.5, 0.25)), /palette UV outside surface rows/);
});

test('màn hình và hình dán được dùng UV tự do trong ảnh', () => {
  assert.equal(finishPaletteExport(makePaletteModel(0.13, 0.27, 'display')), '');
});

test('báo UV của ảnh vượt ra ngoài khung ảnh', () => {
  assert.match(
    finishPaletteExport(makePaletteModel(1.2, 0.27, 'decal')),
    /chair_a has an image UV outside 0\.\.1/,
  );
});

test('báo màn hình không có UV ảnh', () => {
  const { model, bin } = makePaletteModel(0.13, 0.27, 'display');
  model.meshes[0].primitives[0].attributes = { POSITION: 1 };
  assert.match(finishPaletteExport({ model, bin }), /has no image UV/);
});

test('báo UV vượt ra ngoài chiều ngang dải màu', () => {
  assert.match(
    finishPaletteExport(makePaletteModel(1.2, 0.375)),
    /palette UV outside surface rows/,
  );
});

test('module khớp lưới thì đạt', () => {
  const grid = { size: 0.1, axes: [0, 2] };
  assert.deepEqual(finishExport(makeKitRoot(makeKitModel(), { grid })), []);
});

test('báo module lệch lưới', () => {
  const grid = { size: 2, axes: [0] };
  const errors = finishExport(makeKitRoot(makeKitModel(), { grid }));
  assert.match(errors.join('\n'), /chair_a spans 0\.200 m on axis 0, not a multiple of 2/);
});

test('báo module lệch tâm ô', () => {
  const accessors = [
    { count: 3 },
    { count: 3, min: [0, 0, -0.1], max: [0.2, 0.5, 0.1] },
    { count: 1, bufferView: 0, componentType: 5126, type: 'VEC2' },
  ];
  const grid = { size: 0.1, axes: [0] };
  const errors = finishExport(makeKitRoot(makeKitModel({ accessors }), { grid }));
  assert.match(errors.join('\n'), /chair_a is off the cell centre on axis 0/);
});

test('món đồ nằm trong khung kích thước của ô thì đạt', () => {
  assert.deepEqual(finishExport(makeKitRoot(makeKitModel(), { size: [0.3, 0.6, 0.3] })), []);
});

test('báo món đồ to hơn khung kích thước của ô', () => {
  const errors = finishExport(makeKitRoot(makeKitModel(), { size: [0.1, 0.6, 0.3] }));
  assert.match(
    errors.join('\n'),
    /chair_a is 0\.200 x 0\.500 x 0\.200 m, larger than 0\.1 x 0\.6 x 0\.3/,
  );
});

test('ghi dấu xuất mới khi mô hình đúng hợp đồng', () => {
  const { root, config } = makeRoot();
  writeFileSync(join(root, 'source/base.blend'), 'edited');
  assert.deepEqual(finishExport(root), []);
  assert.deepEqual(checkStamp(root, config), []);
});

test('bộ kiểm stamp từ chối tệp xuất mang ảnh xem thử, bỏ qua con trỏ LFS', () => {
  const { root, config } = makeRoot();
  const previewMessage =
    'player.glb was exported from a preview without baked lighting: regenerate without --preview and export again';
  writeFileSync(
    join(root, 'exported/player.glb'),
    makeGlb(makeModel({ images: [{ name: 'player-lightmap-preview' }] })),
  );
  assert.ok(checkStamp(root, config).includes(previewMessage));
  writeFileSync(
    join(root, 'exported/player.glb'),
    'version https://git-lfs.github.com/spec/v1\noid sha256:' + '0'.repeat(64) + '\nsize 10\n',
  );
  assert.equal(checkStamp(root, config).includes(previewMessage), false);
});

test('hậu tố ảnh xem thử trong script Blender khớp với hằng của mã JS', () => {
  const kit = readFileSync(join(ROOT, 'pipeline/hero_kit.py'), 'utf8');
  assert.ok(kit.includes(`PREVIEW_SUFFIX = '${PREVIEW_SUFFIX}'`));
  for (const file of ['pipeline/hero_kit.py', 'pipeline/make_room_kit.py']) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    assert.ok(text.includes('preview_lightmap('), `${file} does not build its preview lightmap`);
  }
});

test('tệp xuất mang ảnh bóng xem thử bị nhận ra để bộ kiểm chặn commit', () => {
  const baked = { images: [{ name: 'lounge-parts-lightmap' }, { name: 'decal' }] };
  const preview = { images: [{ name: 'lounge-parts-lightmap-preview' }] };
  assert.deepEqual(previewImages(baked), []);
  assert.deepEqual(previewImages(preview), ['lounge-parts-lightmap-preview']);
  assert.deepEqual(previewImages({}), []);
});
