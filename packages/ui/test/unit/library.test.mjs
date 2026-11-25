import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { librarySections } from '../../library/sections.mjs';
import { readTokenRules } from '../../src/token-files.mjs';
import { tokenDefaults } from '../../src/tokens.mjs';
import { copyLibrary, libraryEntries } from '../../tools/library-files.mjs';

const text = JSON.parse(readFileSync(new URL('../../library/text.json', import.meta.url), 'utf8'));

test('mọi token ngữ nghĩa có mặt trong thư viện', () => {
  const shown = librarySections().flatMap((section) => section.tokens);
  assert.deepEqual([...new Set(shown)].sort(), Object.keys(tokenDefaults(readTokenRules())).sort());
});

test('mọi mục của thư viện có tên tiếng Việt', () => {
  for (const section of librarySections()) assert.ok(text.sections[section.id], section.id);
});

test('bản xuất bản có đủ trang, token, mã trình duyệt và phông kèm giấy phép', () => {
  const target = mkdtempSync(join(tmpdir(), 'ui-library-'));
  try {
    copyLibrary(target);
    for (const entry of libraryEntries()) assert.ok(existsSync(join(target, entry.to)), entry.to);
    for (const file of [
      'index.html',
      'tokens/semantic.css',
      'components/components.css',
      'components/registry.json',
      'library/components.mjs',
      'src/accent.mjs',
      'fonts/fonts.css',
      'fonts/LICENSE',
    ]) {
      assert.ok(existsSync(join(target, file)), file);
    }
    assert.equal(existsSync(join(target, 'src/token-files.mjs')), false);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
