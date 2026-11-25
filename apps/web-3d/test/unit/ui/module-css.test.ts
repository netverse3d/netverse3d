import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readTokenRules } from '@netverse/ui/token-files';
import { tokenDefaults } from '@netverse/ui/tokens';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const declared = new Set(Object.keys(tokenDefaults(readTokenRules())));
const NAMED_COLORS =
  /(?<![\w-])(?:white|black|red|green|blue|purple|orange|yellow|gray|grey|pink|cyan|magenta)(?![\w-])/i;
const COLOR_LITERAL =
  /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const LITERAL_PROPERTIES =
  /(?:^|[;{\s])(font-size|font-weight|line-height|z-index|border-radius|backdrop-filter|transition-duration|animation-duration)\s*:\s*([^;]+);/g;
const DURATION = /\b\d+(?:\.\d+)?m?s\b/;

function moduleSheets() {
  return ['app', 'src']
    .flatMap((area) =>
      readdirSync(join(root, area), { recursive: true })
        .map(String)
        .filter((name) => name.endsWith('.module.css'))
        .map((name) => join(root, area, name)),
    )
    .map((path) => ({ path: relative(root, path), css: readFileSync(path, 'utf8') }));
}

function rules(css: string) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = '', body = '']) => ({
    selector: selector.trim(),
    body,
  }));
}

test('component không ghi giá trị trực tiếp và chỉ dùng biến đã khai', () => {
  const sheets = moduleSheets();
  assert.ok(sheets.length > 0);
  for (const { path, css } of sheets) {
    assert.doesNotMatch(css, COLOR_LITERAL, path);
    assert.doesNotMatch(css, NAMED_COLORS, path);
    for (const [, property, value] of css.matchAll(LITERAL_PROPERTIES)) {
      assert.match(
        (value ?? '').trim(),
        /^(?:var\(--ui-[\w-]+\)|none|inherit|normal|0|1)$/,
        `${path}: ${property}: ${value}`,
      );
    }
    for (const match of css.matchAll(/transition\s*:\s*([^;]+);/g)) {
      assert.doesNotMatch(match[1] ?? '', DURATION, `${path}: transition: ${match[1]}`);
    }
    for (const [, variable] of css.matchAll(/var\((--[\w-]+)/g)) {
      assert.ok(declared.has(variable ?? ''), `${path}: ${variable}`);
    }
  }
});

test('viền lúc thường không dùng màu focus', () => {
  for (const { path, css } of moduleSheets()) {
    for (const { selector, body } of rules(css)) {
      if (body.includes('var(--ui-focus)'))
        assert.match(selector, /:focus/, `${path}: ${selector}`);
    }
  }
});

test('chữ báo lỗi dùng màu lỗi, chỉ chữ từ chối dùng màu cảnh báo', () => {
  for (const { path, css } of moduleSheets()) {
    for (const { selector, body } of rules(css)) {
      if (/\.error\b/.test(selector) && /(^|\s)color\s*:/.test(body)) {
        assert.match(body, /color\s*:\s*var\(--ui-error\)/, `${path}: ${selector}`);
      }
    }
  }
});
