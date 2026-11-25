import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { librarySections } from '../../library/sections.mjs';
import { readTokenRules } from '../../src/token-files.mjs';
import { tokenDefaults } from '../../src/tokens.mjs';
import { buildLibrary } from '../../tools/library-files.mjs';

const text = JSON.parse(readFileSync(new URL('../../library/text.json', import.meta.url), 'utf8'));

test('mọi token ngữ nghĩa có mặt trong thư viện', () => {
  const shown = librarySections().flatMap((section) => section.tokens);
  assert.deepEqual([...new Set(shown)].sort(), Object.keys(tokenDefaults(readTokenRules())).sort());
});

test('mọi mục của thư viện có tên tiếng Việt', () => {
  for (const section of librarySections()) assert.ok(text.sections[section.id], section.id);
});

test('bản xuất bản có trang, mã React đã gói, phông kèm giấy phép', async () => {
  const target = mkdtempSync(join(tmpdir(), 'ui-library-'));
  try {
    await buildLibrary(target);
    for (const file of ['index.html', 'library.js', 'library.css', 'fonts/LICENSE'])
      assert.ok(existsSync(join(target, file)), file);
    const page = readFileSync(join(target, 'index.html'), 'utf8');
    assert.ok(page.includes('src="./library.js"'), 'mã');
    assert.ok(page.includes('href="./library.css"'), 'CSS');
    const assets = readdirSync(join(target, 'assets'));
    assert.ok(
      assets.some((file) => file.endsWith('.woff2')),
      'phông',
    );
    assert.ok(
      assets.some((file) => file.startsWith('shop-') && file.endsWith('.jpg')),
      'ảnh tiệm',
    );
    const css = readFileSync(join(target, 'library.css'), 'utf8');
    assert.ok(css.includes('.nv-button'), 'CSS component');
    assert.ok(css.includes('--ui-surface'), 'token');
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
