import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildStamp,
  checkAssets,
  checkModel,
  checkStamp,
  contentId,
  finishExport,
  isLfsPointer,
  readGlb,
  stampPath,
} from './lib.mjs';

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

function makeKitModel(overrides = {}) {
  return {
    nodes: [
      { name: 'chair_a', mesh: 0, children: [1] },
      { name: 'chair_a__seat_anchor', translation: [0, 0.4, 0] },
    ],
    meshes: [{ primitives: [{ indices: 0, material: 0, attributes: { POSITION: 1 } }] }],
    accessors: [{ count: 3 }, { count: 3, min: [-0.1, 0, -0.1], max: [0.1, 0.5, 0.1] }],
    materials: [{ name: 'surface' }],
    ...overrides,
  };
}

function makeKitRoot(model, slotOverrides = {}, configOverrides = {}, bin = undefined) {
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
    JSON.stringify({ ...config, kits: [kit], ...configOverrides }),
  );
  writeFileSync(join(root, 'source/parts.blend'), 'parts');
  writeFileSync(join(root, 'exported/parts.glb'), makeGlb(model, bin));
  return root;
}

test('ô đồ đủ điểm gắn thì được ghi dấu xuất', () => {
  assert.deepEqual(finishExport(makeKitRoot(makeKitModel())), []);
});

test('báo ghế thiếu điểm ngồi', () => {
  const nodes = [{ name: 'chair_a', mesh: 0 }];
  const errors = finishExport(makeKitRoot(makeKitModel({ nodes })));
  assert.match(errors.join('\n'), /chair_a is missing anchor seat_anchor/);
});

test('báo thiếu biến thể đã khai trong cấu hình', () => {
  const errors = finishExport(makeKitRoot(makeKitModel(), { variants: ['a', 'b'] }));
  assert.match(errors.join('\n'), /missing mesh: chair_b/);
});

const PALETTE = {
  surface: ['body', 'soft'],
  glow: ['strip', 'keycap'],
  images: ['display', 'decal'],
};

function makePaletteModel(u, v, material = 'surface') {
  const bin = Buffer.alloc(8);
  bin.writeFloatLE(u, 0);
  bin.writeFloatLE(v, 4);
  const model = makeKitModel({
    meshes: [
      { primitives: [{ indices: 0, material: 0, attributes: { POSITION: 1, TEXCOORD_0: 2 } }] },
    ],
    accessors: [
      ...makeKitModel().accessors,
      { count: 1, bufferView: 0, componentType: 5126, type: 'VEC2' },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }],
    materials: [{ name: material }],
  });
  return { model, bin };
}

function finishPaletteExport({ model, bin }) {
  return finishExport(makeKitRoot(model, {}, { palette: PALETTE }, bin)).join('\n');
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
    /decal has an image UV outside 0\.\.1|has an image UV outside 0\.\.1/,
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
