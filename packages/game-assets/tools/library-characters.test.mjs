import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  clipGroups,
  faceFor,
  handPropFor,
  meshBudgets,
} from '../library/shared/characters-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
const TEXT = JSON.parse(readFileSync(join(ROOT, 'library/shared/text.json'), 'utf8'));

test('hành động và biểu cảm tách riêng, đứng yên đứng đầu, biểu cảm bỏ tiền tố', () => {
  assert.deepEqual(clipGroups(['walk', 'ex_smile', 'idle', 'ex_sad', 'typing']), {
    actions: ['idle', 'walk', 'typing'],
    expressions: ['smile', 'sad'],
  });
  assert.deepEqual(clipGroups([]), { actions: [], expressions: [] });
});

test('mỗi hành động đi kèm một khuôn mặt, biểu cảm thì dùng đúng khuôn mặt của nó', () => {
  assert.equal(faceFor('ex_wink'), 'wink');
  assert.equal(faceFor('typing'), 'focus');
  assert.equal(faceFor('drink'), 'sip');
  assert.equal(faceFor('idle'), 'smile');
  assert.equal(faceFor('khong-co'), 'smile');
});

test('chỉ lúc uống nước mới cầm ly và chỉ lúc bê thùng mới cầm thùng', () => {
  assert.equal(handPropFor('drink'), 'cup');
  assert.equal(handPropFor('carry'), 'crate');
  assert.equal(handPropFor('idle'), null);
  assert.equal(handPropFor('ex_smile'), null);
});

test('mức trần tam giác của từng phần lấy từ cấu hình, có bản nhẹ thì kèm mức của bản nhẹ', () => {
  const config = {
    character: {
      meshes: {
        body: { maxTriangles: 28000, lodTriangles: 7000 },
        glasses: { maxTriangles: 1200 },
      },
    },
  };
  assert.deepEqual(meshBudgets(config), [
    { name: 'body', maxTriangles: 28000, lodTriangles: 7000 },
    { name: 'glasses', maxTriangles: 1200, lodTriangles: null },
  ]);
  assert.deepEqual(meshBudgets({}), []);
});

test('mọi hành động, biểu cảm và phần của nhân vật thật đều có tên tiếng Việt', () => {
  const groups = clipGroups(CONFIG.clips);
  assert.ok(groups.actions.length > 0 && groups.expressions.length > 0);
  for (const name of groups.actions) {
    assert.ok(TEXT.characters.actions[name], `action ${name} has no display name`);
  }
  for (const name of groups.expressions) {
    assert.ok(TEXT.characters.expressions[name], `expression ${name} has no display name`);
  }
  for (const { name } of meshBudgets(CONFIG)) {
    assert.ok(TEXT.characters.meshes[name], `mesh ${name} has no display name`);
  }
});
