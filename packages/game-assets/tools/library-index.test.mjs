import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  catalogSection,
  kitIndex,
  sectionCards,
  sectionHref,
  sectionKits,
} from '../library/shared/catalog.mjs';
import { partGroups } from '../library/shared/parts-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIBRARY = join(ROOT, 'library');
const SECTIONS = JSON.parse(readFileSync(join(LIBRARY, 'shared/sections.json'), 'utf8'));
const TEXT = JSON.parse(readFileSync(join(LIBRARY, 'shared/text.json'), 'utf8'));
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
const INSPECT_PAGE = 'lab.html';

const FAKE_SECTIONS = [
  { id: 'overview', title: 'Tổng quan', summary: 'x', state: 'rebuilt', href: 'index.html' },
  {
    id: 'parts',
    title: 'Món đồ',
    summary: 'x',
    state: 'rebuilt',
    href: 'catalog.html?section=parts',
    kits: ['station.glb', 'lounge.glb'],
  },
  {
    id: 'street',
    title: 'Phố',
    summary: 'x',
    state: 'rebuilt',
    href: 'catalog.html?section=street',
    kits: ['street.glb'],
  },
];
const FAKE_CONFIG = {
  kits: [
    { file: 'station.glb', slots: { desk: { variants: ['a', 'b'] }, chair: { variants: ['a'] } } },
    { file: 'street.glb', slots: { road: { variants: ['a', 'b', 'c'] } } },
    { file: 'orphan.glb', slots: { thing: { variants: ['a'] } } },
  ],
};

test('mọi bộ mô hình trong cấu hình thuộc đúng một mục của thư viện, không bộ nào bị bỏ sót hay khai hai lần', () => {
  for (const kit of CONFIG.kits) {
    const owners = SECTIONS.filter((section) => sectionKits(section).includes(kit.file));
    assert.equal(owners.length, 1, `${kit.file} belongs to ${owners.length} sections`);
  }
});

test('mục nào khai bộ mô hình thì bộ đó phải có trong cấu hình và có tên tiếng Việt', () => {
  const files = new Set(CONFIG.kits.map((kit) => kit.file));
  for (const section of SECTIONS) {
    for (const file of sectionKits(section)) {
      assert.ok(files.has(file), `${section.id} lists unknown kit ${file}`);
      assert.ok(TEXT.parts.kits[file], `${file} has no display name`);
    }
  }
});

test('mọi ô đồ của mọi bộ đều có tên tiếng Việt để danh mục không hiện mã ô', () => {
  for (const kit of CONFIG.kits) {
    for (const slot of Object.keys(kit.slots)) {
      assert.ok(TEXT.parts.slots[slot], `${kit.file}: slot ${slot} has no display name`);
    }
  }
});

test('các mục có bộ mô hình dùng chung một trang danh mục, mỗi mục một địa chỉ riêng, và có trang soi từng món', () => {
  const catalogues = SECTIONS.filter((section) => sectionKits(section).length > 0);
  assert.deepEqual(
    catalogues.map((section) => section.id),
    ['parts', 'rooms', 'street'],
  );
  for (const section of catalogues) {
    assert.equal(section.state, 'rebuilt', section.id);
    assert.equal(sectionHref(section), `catalog.html?section=${section.id}`);
    assert.ok(existsSync(join(LIBRARY, 'catalog.html')));
    assert.ok(
      section.pages.some((page) => page.src.startsWith(INSPECT_PAGE)),
      `${section.id} has no inspect page`,
    );
  }
});

test('trang danh mục đọc địa chỉ để biết đang ở mục nào; địa chỉ lạ thì về mục danh mục đầu tiên', () => {
  assert.equal(catalogSection(FAKE_SECTIONS, '?section=street').id, 'street');
  assert.equal(catalogSection(FAKE_SECTIONS, '?section=parts&q=desk').id, 'parts');
  assert.equal(catalogSection(FAKE_SECTIONS, '?section=overview').id, 'parts');
  assert.equal(catalogSection(FAKE_SECTIONS, '').id, 'parts');
});

test('danh mục của một mục chỉ gồm các bộ của mục đó, theo thứ tự mục khai', () => {
  assert.deepEqual(
    partGroups(FAKE_CONFIG, ['street.glb', 'station.glb']).map((group) => group.kit),
    ['street.glb', 'station.glb'],
  );
  assert.deepEqual(partGroups(FAKE_CONFIG, ['lounge.glb']), []);
  assert.deepEqual(partGroups({}, ['station.glb']), []);
});

test('bảng chỉ mục liệt kê từng bộ mô hình với số ô, số biến thể và mục chứa nó', () => {
  assert.deepEqual(kitIndex(FAKE_CONFIG, FAKE_SECTIONS), [
    {
      file: 'station.glb',
      slots: 2,
      variants: 3,
      section: 'parts',
      title: 'Món đồ',
      href: 'catalog.html?section=parts',
    },
    {
      file: 'street.glb',
      slots: 1,
      variants: 3,
      section: 'street',
      title: 'Phố',
      href: 'catalog.html?section=street',
    },
    { file: 'orphan.glb', slots: 1, variants: 1, section: null, title: null, href: null },
  ]);
  assert.deepEqual(kitIndex({}, FAKE_SECTIONS), []);
});

test('con số trên thẻ của mục danh mục là tổng biến thể của các bộ thuộc mục đó', () => {
  const cards = sectionCards(FAKE_SECTIONS, {}, FAKE_CONFIG);
  const figure = (id) => cards.find((card) => card.id === id)?.figure;
  assert.deepEqual(figure('parts'), { value: 3, unit: 'variants' });
  assert.deepEqual(figure('street'), { value: 3, unit: 'variants' });
});

test('bảng chỉ mục thật: mọi bộ đều trỏ tới một mục mở được', () => {
  for (const row of kitIndex(CONFIG, SECTIONS)) {
    assert.ok(row.section, `${row.file} is not indexed`);
    assert.ok(row.href, `${row.file} has no link`);
    assert.ok(row.variants >= row.slots && row.slots > 0, row.file);
  }
});
