import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SECTION_STATES,
  catalogSummary,
  navItems,
  sectionCards,
} from '../library/shared/catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = join(ROOT, 'library');
const SECTIONS = JSON.parse(readFileSync(join(LIBRARY, 'shared/sections.json'), 'utf8'));

const CONFIG = {
  clips: ['idle', 'walk', 'ex_smile', 'ex_sad', 'typing'],
  kits: [
    {
      file: 'station-parts.glb',
      slots: { desk: { variants: ['a', 'b', 'c'] }, chair: { variants: ['a'] } },
    },
    { file: 'room-kit.glb', slots: { wall: { variants: ['a'] }, floor: { variants: ['a'] } } },
  ],
  scenes: [{ id: 'showcase-tim-neon' }],
};

test('mỗi mục của thư viện có tên riêng, tiêu đề, mô tả và một trạng thái hợp lệ', () => {
  const ids = SECTIONS.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const section of SECTIONS) {
    assert.match(section.id, /^[a-z]+$/, section.id);
    assert.ok(section.title.length > 0 && section.summary.length > 0, section.id);
    assert.ok(SECTION_STATES.includes(section.state), `${section.id}: ${section.state}`);
  }
});

test('thư viện chia mục theo loại tài sản, đúng thứ tự đã chốt, Lưu trữ đứng cuối', () => {
  assert.deepEqual(
    SECTIONS.map((section) => section.id),
    ['overview', 'characters', 'parts', 'rooms', 'shops', 'checks', 'archive'],
  );
});

test('mục nào có trang thì trang đó phải tồn tại; mục sắp có thì chưa có đường dẫn', () => {
  for (const section of SECTIONS) {
    const pages = [section.href, ...(section.more ?? []).map((link) => link.href)];
    if (section.state === 'planned') {
      assert.equal(section.href, null, section.id);
      continue;
    }
    for (const href of pages) {
      const file = href.split(/[?#]/)[0];
      assert.ok(existsSync(join(LIBRARY, file)), `${section.id} points to missing ${file}`);
    }
  }
  assert.equal(SECTIONS[0].href, 'index.html');
});

test('thanh mục đánh dấu đúng một mục đang xem và không cho bấm vào mục sắp có', () => {
  const items = navItems(SECTIONS, 'parts');
  assert.equal(items.length, SECTIONS.length);
  assert.deepEqual(
    items.filter((item) => item.current).map((item) => item.id),
    ['parts'],
  );
  const planned = items.find((item) => item.state === 'planned');
  assert.equal(planned?.href, null);
  assert.equal(navItems(SECTIONS, 'unknown').filter((item) => item.current).length, 0);
});

test('số liệu tổng quan đếm từ cấu hình tài sản: món, biến thể, hành động, biểu cảm, tiệm mẫu', () => {
  assert.deepEqual(catalogSummary(CONFIG, ['tim-neon', 'bien-sau']), {
    slots: 4,
    variants: 6,
    stationVariants: 4,
    roomVariants: 2,
    actions: 3,
    expressions: 2,
    shops: 2,
    scenes: 1,
  });
});

test('cấu hình thiếu phần nào thì phần đó đếm là không, không sập trang', () => {
  assert.deepEqual(catalogSummary({}, []), {
    slots: 0,
    variants: 0,
    stationVariants: 0,
    roomVariants: 0,
    actions: 0,
    expressions: 0,
    shops: 0,
    scenes: 0,
  });
});

test('thẻ của từng mục mang đúng con số của mục đó, trang Tổng quan không tự có thẻ', () => {
  const summary = catalogSummary(CONFIG, ['tim-neon', 'bien-sau']);
  const cards = sectionCards(SECTIONS, summary);
  assert.equal(
    cards.some((card) => card.id === 'overview'),
    false,
  );
  const figure = (id) => cards.find((card) => card.id === id)?.figure;
  assert.deepEqual(figure('characters'), { value: 3, unit: 'actions' });
  assert.deepEqual(figure('parts'), { value: 4, unit: 'variants' });
  assert.deepEqual(figure('rooms'), { value: 2, unit: 'modules' });
  assert.deepEqual(figure('shops'), { value: 2, unit: 'shops' });
  assert.equal(figure('checks'), null);
  assert.equal(figure('archive'), null);
});

test('số liệu thật của repo khớp với cấu hình tài sản đang lưu', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
  const recipes = JSON.parse(readFileSync(join(ROOT, 'recipes/index.json'), 'utf8'));
  const summary = catalogSummary(config, recipes);
  assert.equal(summary.shops, recipes.length);
  assert.equal(summary.actions + summary.expressions, config.clips.length);
  assert.ok(summary.variants >= summary.slots && summary.slots > 0);
});
