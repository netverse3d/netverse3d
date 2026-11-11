import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  contentTypeOf,
  copyLibrary,
  findUnusableModels,
  resolveRequestPath,
} from './library-files.mjs';

const POINTER = `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 9\n`;
const REAL_MODEL = 'glTF real model';
const CONFIG = {
  character: { file: 'player.glb', lodFile: 'player-lod.glb', meshes: {} },
  props: [],
  kits: [{ file: 'station-parts.glb', source: 'parts.blend', slots: {} }],
};

function makeRoot(glb = REAL_MODEL) {
  const root = mkdtempSync(join(tmpdir(), 'asset-library-'));
  for (const folder of ['library/models', 'exported', 'source', 'runtime', 'recipes']) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  writeFileSync(join(root, 'assets.config.json'), JSON.stringify(CONFIG));
  writeFileSync(join(root, 'keyboards.json'), '{}');
  writeFileSync(join(root, 'library/index.html'), '<title>x</title>');
  writeFileSync(join(root, 'runtime/shop-look.mjs'), 'export const x = 1;');
  writeFileSync(join(root, 'runtime/shop-look.test.mjs'), 'test');
  writeFileSync(join(root, 'recipes/tim-neon.json'), '{}');
  writeFileSync(join(root, 'library/models/bot-d1.glb'), REAL_MODEL);
  writeFileSync(join(root, 'library/models/human-hoodie.glb'), REAL_MODEL);
  writeFileSync(join(root, 'exported/player.glb'), glb);
  writeFileSync(join(root, 'exported/player-lod.glb'), REAL_MODEL);
  writeFileSync(join(root, 'exported/station-parts.glb'), REAL_MODEL);
  writeFileSync(join(root, 'exported/export-stamp.json'), '{}');
  writeFileSync(join(root, 'source/base.blend'), 'blend');
  return root;
}

test('trả về trang thư viện khi xin thư mục library', () => {
  const root = makeRoot();
  assert.equal(resolveRequestPath(root, '/library/'), join(root, 'library/index.html'));
});

test('phục vụ mô hình đã xuất', () => {
  const root = makeRoot();
  assert.equal(resolveRequestPath(root, '/exported/player.glb'), join(root, 'exported/player.glb'));
});

test('phục vụ mã chạy và công thức tiệm cho trang thư viện', () => {
  const root = makeRoot();
  assert.equal(
    resolveRequestPath(root, '/runtime/shop-look.mjs'),
    join(root, 'runtime/shop-look.mjs'),
  );
  assert.equal(
    resolveRequestPath(root, '/recipes/tim-neon.json'),
    join(root, 'recipes/tim-neon.json'),
  );
});

test('phục vụ hợp đồng assets.config.json nhưng không phục vụ tệp gốc khác', () => {
  const root = makeRoot();
  assert.equal(resolveRequestPath(root, '/assets.config.json'), join(root, 'assets.config.json'));
  assert.equal(resolveRequestPath(root, '/package.json'), null);
});

test('khai kiểu nội dung cho mã và JSON', () => {
  assert.equal(contentTypeOf('a.mjs'), 'text/javascript');
  assert.equal(contentTypeOf('a.json'), 'application/json');
});

test('không phục vụ tệp ngoài thư mục được phép', () => {
  const root = makeRoot();
  assert.equal(resolveRequestPath(root, '/source/base.blend'), null);
  assert.equal(resolveRequestPath(root, '/tools/lib.mjs'), null);
});

test('chặn đường dẫn thoát khỏi thư mục gốc', () => {
  const root = makeRoot();
  assert.equal(resolveRequestPath(root, '/library/..%2F..%2Fsecret'), null);
  assert.equal(resolveRequestPath(root, '/library/%2e%2e/%2e%2e/secret'), null);
  assert.equal(resolveRequestPath(root, '/library/..%5c..%5csecret'), null);
});

test('đường dẫn mã hoá sai thì coi như không có', () => {
  assert.equal(resolveRequestPath(makeRoot(), '/library/%E0%A4%A'), null);
});

test('khai đúng kiểu nội dung', () => {
  assert.equal(contentTypeOf('a.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeOf('a.glb'), 'model/gltf-binary');
  assert.equal(contentTypeOf('a.bin'), 'application/octet-stream');
});

test('tìm ra mô hình mới chỉ là con trỏ LFS', () => {
  assert.deepEqual(findUnusableModels(makeRoot()), []);
  assert.deepEqual(findUnusableModels(makeRoot(POINTER)), ['exported/player.glb']);
});

test('tìm ra mô hình rỗng hoặc không phải GLB', () => {
  assert.deepEqual(findUnusableModels(makeRoot('')), ['exported/player.glb']);
  assert.deepEqual(findUnusableModels(makeRoot('not a model')), ['exported/player.glb']);
});

test('tìm ra mô hình bắt buộc bị thiếu', () => {
  const root = makeRoot();
  rmSync(join(root, 'exported/player-lod.glb'));
  rmSync(join(root, 'library/models/bot-d1.glb'));
  assert.deepEqual(findUnusableModels(root), [
    'exported/player-lod.glb',
    'library/models/bot-d1.glb',
  ]);
});

test('tìm ra tệp bộ ô đồ bị thiếu', () => {
  const root = makeRoot();
  rmSync(join(root, 'exported/station-parts.glb'));
  assert.deepEqual(findUnusableModels(root), ['exported/station-parts.glb']);
});

test('sao chép trang và mô hình, không kèm tệp gốc', () => {
  const root = makeRoot();
  const target = join(root, 'out');
  assert.deepEqual(copyLibrary(root, target), []);
  assert.equal(readFileSync(join(target, 'exported/player.glb'), 'utf8'), REAL_MODEL);
  assert.equal(existsSync(join(target, 'library/index.html')), true);
  assert.equal(existsSync(join(target, 'library/models/bot-d1.glb')), true);
  assert.equal(existsSync(join(target, 'exported/export-stamp.json')), false);
  assert.equal(existsSync(join(target, 'source')), false);
  assert.equal(existsSync(join(target, 'runtime/shop-look.mjs')), true);
  assert.equal(existsSync(join(target, 'runtime/shop-look.test.mjs')), false);
  assert.equal(existsSync(join(target, 'recipes/tim-neon.json')), true);
  assert.equal(existsSync(join(target, 'assets.config.json')), true);
  assert.equal(existsSync(join(target, 'keyboards.json')), true);
});

test('từ chối xuất bản khi mô hình mới là con trỏ LFS', () => {
  const root = makeRoot(POINTER);
  const target = join(root, 'out');
  assert.deepEqual(copyLibrary(root, target), ['exported/player.glb']);
  assert.equal(existsSync(target), false);
});
