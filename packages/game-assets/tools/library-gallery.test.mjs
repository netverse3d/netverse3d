import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SECTION_STATES,
  STAGE_PAGE,
  carriedQuery,
  catalogSummary,
  framedSource,
  navItems,
  pageHref,
  sectionCards,
  sectionHref,
  sectionTabs,
  stageTarget,
  whereIs,
} from '../library/shared/catalog.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = join(ROOT, 'library');
const SECTIONS = JSON.parse(readFileSync(join(LIBRARY, 'shared/sections.json'), 'utf8'));
const OLD_PAGES = [
  'studio.html',
  'gallery.html',
  'lab.html',
  'shop.html',
  'showcase.html',
  'street.html',
];
const withPages = (section) => (section.pages ?? []).length > 0;

const CONFIG = {
  clips: ['idle', 'walk', 'ex_smile', 'ex_sad', 'typing'],
  kits: [
    {
      file: 'station-parts.glb',
      slots: { desk: { variants: ['a', 'b', 'c'] }, chair: { variants: ['a'] } },
    },
    { file: 'room-kit.glb', slots: { wall: { variants: ['a'] }, floor: { variants: ['a'] } } },
    { file: 'lounge-parts.glb', slots: { sofa: { variants: ['a'] } } },
  ],
  scenes: [{ id: 'showcase-tim-neon' }],
};

function fileOf(href) {
  return href.split(/[?#]/)[0];
}

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
    ['overview', 'characters', 'parts', 'rooms', 'street', 'shops', 'checks', 'archive'],
  );
});

test('mục còn trang cũ khai rõ từng trang con có tiêu đề, và trang đó phải tồn tại', () => {
  for (const section of SECTIONS.filter((item) => item.state === 'legacy')) {
    assert.ok(withPages(section), section.id);
  }
  for (const section of SECTIONS.filter(withPages)) {
    for (const page of section.pages) {
      assert.ok(page.title.length > 0, `${section.id} has an untitled page`);
      assert.ok(OLD_PAGES.includes(fileOf(page.src)), `${section.id}: ${page.src}`);
      assert.ok(existsSync(join(LIBRARY, fileOf(page.src))), `${section.id}: ${page.src}`);
    }
  }
});

test('mọi trang cũ đều thuộc ít nhất một mục, không trang nào bị bỏ rơi ngoài khung', () => {
  const used = new Set(
    SECTIONS.flatMap((section) => (section.pages ?? []).map((page) => fileOf(page.src))),
  );
  assert.deepEqual([...used].sort(), [...OLD_PAGES].sort());
});

test('bấm vào mục nào cũng ở lại trong khung: mục cũ mở qua trang khung, không mở thẳng trang cũ', () => {
  assert.ok(existsSync(join(LIBRARY, STAGE_PAGE)));
  for (const section of SECTIONS) {
    const href = sectionHref(section);
    if (section.state === 'planned') {
      assert.equal(href, null, section.id);
    } else if (section.state === 'legacy') {
      assert.equal(href, `${STAGE_PAGE}?section=${section.id}`);
    } else {
      assert.ok(existsSync(join(LIBRARY, fileOf(href))), `${section.id}: ${href}`);
      assert.equal(OLD_PAGES.includes(fileOf(href)), false, section.id);
    }
  }
  assert.equal(sectionHref(SECTIONS[0]), 'index.html');
});

test('trang con thứ hai trở đi của một mục có đường dẫn riêng trong khung', () => {
  const parts = SECTIONS.find((section) => section.id === 'parts');
  assert.equal(pageHref(parts, 0), `${STAGE_PAGE}?section=parts`);
  assert.equal(pageHref(parts, 1), `${STAGE_PAGE}?section=parts&page=1`);
});

test('thanh mục đánh dấu đúng một mục đang xem và không cho bấm vào mục sắp có', () => {
  const items = navItems(SECTIONS, 'parts');
  assert.equal(items.length, SECTIONS.length);
  assert.deepEqual(
    items.filter((item) => item.current).map((item) => item.id),
    ['parts'],
  );
  assert.equal(items.find((item) => item.id === 'parts')?.href, 'catalog.html?section=parts');
  assert.equal(items.find((item) => item.id === 'shops')?.href, `${STAGE_PAGE}?section=shops`);
  const upcoming = navItems(
    [{ id: 'later', title: 'Sau', summary: 'Chưa có trang.', state: 'planned' }],
    'parts',
  );
  assert.equal(upcoming[0].href, null);
  assert.equal(navItems(SECTIONS, 'unknown').filter((item) => item.current).length, 0);
});

test('khung đọc địa chỉ để biết mở mục nào, trang con nào; địa chỉ lạ thì về mục đầu tiên có trang', () => {
  assert.deepEqual(stageTarget(SECTIONS, '?section=shops&page=1'), { section: 'shops', page: 1 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=shops'), { section: 'shops', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=shops&page=9'), { section: 'shops', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=shops&page=-1'), { section: 'shops', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=checks'), { section: 'characters', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=overview'), { section: 'characters', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, '?section=khong-co'), { section: 'characters', page: 0 });
  assert.deepEqual(stageTarget(SECTIONS, ''), { section: 'characters', page: 0 });
});

test('trang cũ nạp vào khung giữ nguyên tham số và dấu thăng của nó, thêm dấu để nạp lại khi đổi trang con', () => {
  assert.equal(framedSource('studio.html#pho', 2), 'studio.html?framed=2#pho');
  assert.equal(framedSource('lab.html?part=wall_a', 0), 'lab.html?part=wall_a&framed=0');
  assert.equal(framedSource('gallery.html', 1), 'gallery.html?framed=1');
});

test('trang cũ tự chuyển hướng bên trong khung thì khung biết nó thuộc mục nào để đánh dấu lại', () => {
  assert.deepEqual(whereIs(SECTIONS, 'shop.html', '', 'parts'), { section: 'shops', page: 0 });
  assert.deepEqual(whereIs(SECTIONS, 'showcase.html', '', 'parts'), { section: 'shops', page: 1 });
  assert.deepEqual(whereIs(SECTIONS, 'studio.html', '#pho', 'parts'), {
    section: 'archive',
    page: 0,
  });
  assert.deepEqual(whereIs(SECTIONS, 'studio.html', '', 'parts'), {
    section: 'characters',
    page: 0,
  });
});

test('trang dùng chung cho hai mục thì giữ nguyên mục đang xem', () => {
  assert.equal(whereIs(SECTIONS, 'lab.html', '', 'rooms')?.section, 'rooms');
  assert.equal(whereIs(SECTIONS, 'lab.html', '', 'parts')?.section, 'parts');
  assert.equal(whereIs(SECTIONS, 'lab.html', '', 'shops')?.section, 'parts');
  assert.equal(whereIs(SECTIONS, 'not-a-page.html', '', 'parts'), null);
});

test('số liệu tổng quan đếm từ cấu hình tài sản: món, biến thể, hành động, biểu cảm, tiệm mẫu', () => {
  assert.deepEqual(catalogSummary(CONFIG, ['tim-neon', 'bien-sau']), {
    slots: 5,
    variants: 7,
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
    actions: 0,
    expressions: 0,
    shops: 0,
    scenes: 0,
  });
});

test('thẻ của từng mục mang đúng con số và mọi nút trên thẻ đều mở trong khung', () => {
  const summary = catalogSummary(CONFIG, ['tim-neon', 'bien-sau']);
  const cards = sectionCards(SECTIONS, summary, CONFIG);
  assert.equal(
    cards.some((card) => card.id === 'overview'),
    false,
  );
  const figure = (id) => cards.find((card) => card.id === id)?.figure;
  assert.deepEqual(figure('characters'), { value: 3, unit: 'actions' });
  assert.deepEqual(figure('parts'), { value: 5, unit: 'variants' });
  assert.deepEqual(figure('rooms'), { value: 2, unit: 'variants' });
  assert.equal(figure('street'), null);
  assert.deepEqual(figure('shops'), { value: 2, unit: 'shops' });
  assert.equal(figure('checks'), null);
  assert.equal(figure('archive'), null);
  for (const card of cards) {
    for (const href of [card.href, ...card.more.map((link) => link.href)].filter(Boolean)) {
      assert.equal(OLD_PAGES.includes(fileOf(href)), false, `${card.id} leaves the frame: ${href}`);
    }
  }
  const shops = cards.find((card) => card.id === 'shops');
  assert.deepEqual(
    shops?.more.map((link) => link.href),
    [`${STAGE_PAGE}?section=shops&page=1`],
  );
});

test('mục đã dựng lại mở trang mới của nó, các trang cũ còn lại thành nút phụ mở trong khung', () => {
  const parts = SECTIONS.find((section) => section.id === 'parts');
  assert.equal(parts.state, 'rebuilt');
  assert.equal(sectionHref(parts), 'catalog.html?section=parts');
  const card = sectionCards(SECTIONS, catalogSummary(CONFIG, []), CONFIG).find(
    (item) => item.id === 'parts',
  );
  assert.deepEqual(
    card.more.map((link) => link.href),
    parts.pages.map((page, index) => pageHref(parts, index)),
  );
  assert.deepEqual(stageTarget(SECTIONS, '?section=parts'), { section: 'parts', page: 0 });
});

test('dãy thẻ của mục đã dựng lại có trang mới đứng đầu rồi tới các trang cũ, đánh dấu đúng trang đang xem', () => {
  const parts = SECTIONS.find((section) => section.id === 'parts');
  const onMain = sectionTabs(parts, 'main', 'Danh mục');
  assert.deepEqual(onMain[0], {
    title: 'Danh mục',
    href: 'catalog.html?section=parts',
    page: null,
    current: true,
  });
  assert.equal(onMain.length, parts.pages.length + 1);
  assert.equal(onMain.filter((tab) => tab.current).length, 1);
  const onLab = sectionTabs(parts, 0, 'Danh mục');
  assert.deepEqual(onLab[1], {
    title: parts.pages[0].title,
    href: pageHref(parts, 0),
    page: 0,
    current: true,
  });
  assert.equal(onLab[0].current, false);
});

test('dãy thẻ của mục còn trang cũ chỉ gồm các trang cũ', () => {
  const shops = SECTIONS.find((section) => section.id === 'shops');
  assert.deepEqual(
    sectionTabs(shops, 1, 'Danh mục').map((tab) => [tab.page, tab.current]),
    [
      [0, false],
      [1, true],
    ],
  );
});

test('khung chuyển tiếp tham số riêng của trang cũ, như món cần soi, và bỏ tham số của chính khung', () => {
  assert.equal(carriedQuery('?section=parts&part=desk_b&spin=0'), 'part=desk_b&spin=0');
  assert.equal(carriedQuery('?section=parts&page=1'), '');
  assert.equal(carriedQuery(''), '');
  assert.equal(
    framedSource('lab.html', 0, 'part=desk_b&spin=0'),
    'lab.html?part=desk_b&spin=0&framed=0',
  );
  assert.equal(
    framedSource('lab.html?part=wall_a', 0, 'part=desk_b'),
    'lab.html?part=desk_b&framed=0',
  );
  assert.equal(framedSource('studio.html#pho', 2, ''), 'studio.html?framed=2#pho');
});

test('số liệu thật của repo khớp với cấu hình tài sản đang lưu', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
  const recipes = JSON.parse(readFileSync(join(ROOT, 'recipes/index.json'), 'utf8'));
  const summary = catalogSummary(config, recipes);
  assert.equal(summary.shops, recipes.length);
  assert.equal(summary.actions + summary.expressions, config.clips.length);
  assert.ok(summary.variants >= summary.slots && summary.slots > 0);
});
