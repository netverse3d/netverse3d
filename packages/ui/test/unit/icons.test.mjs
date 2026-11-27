import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadDemos } from '../support/demos.mjs';

const ICONS_IN_USE = ['bell', 'close', 'check', 'chevron', 'chevronDown', 'lock', 'mail', 'alert'];

test('mọi tên icon đăng ký vẽ ra được hình', async () => {
  const { ICON_NAMES, renderIcon } = await loadDemos();
  assert.ok(ICON_NAMES.length > 0);
  for (const name of ICONS_IN_USE) assert.ok(ICON_NAMES.includes(name), name);
  for (const name of ICON_NAMES) {
    const markup = renderIcon(name);
    assert.match(markup, /^<svg[^>]*aria-hidden="true"/, name);
    assert.match(markup, /<path d="M[^"]{20,}"/, name);
  }
});

test('icon lấy từ bộ Phosphor, không còn đường vẽ tay', () => {
  const source = readFileSync(new URL('../../react/icon.tsx', import.meta.url), 'utf8');
  assert.match(source, /from '@phosphor-icons\/react\/dist\/ssr'/);
  assert.doesNotMatch(source, /ICON_PATHS|viewBox="0 0 24 24"/);
});
