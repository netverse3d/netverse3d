import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
    for (const match of css.matchAll(/(?:^|[;{\s])font\s*:\s*([^;]+);/g)) {
      assert.doesNotMatch(match[1] ?? '', /(?:^|\s)\d|px|rem/, `${path}: font: ${match[1]}`);
    }
    for (const match of css.matchAll(/(?:transition|animation)\s*:\s*([^;]+);/g)) {
      assert.doesNotMatch(match[1] ?? '', DURATION, `${path}: ${match[0]}`);
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

function layerOf(css: string, selector: string): string | undefined {
  return rules(css)
    .find((rule) => rule.selector === selector)
    ?.body.match(/z-index:\s*var\((--ui-layer-[\w-]+)\)/)?.[1];
}

test('thanh ứng dụng nằm dưới panel phiên thuê máy và desktop', () => {
  const sheets = Object.fromEntries(
    moduleSheets().map(({ path, css }) => [path.split(sep).join('/'), css]),
  );
  const order = [
    '--ui-layer-canvas',
    '--ui-layer-world',
    '--ui-layer-chrome',
    '--ui-layer-hud',
    '--ui-layer-toast',
    '--ui-layer-dialog',
    '--ui-layer-recovery',
  ];
  const rank = (sheet: string, selector: string) =>
    order.indexOf(layerOf(sheets[sheet] ?? '', selector) ?? '');
  const chrome = [
    rank('src/ui/account-panel.module.css', '.accountBar'),
    rank('src/ui/pwa-actions.module.css', '.actions'),
  ];
  const play = [
    rank('src/ui/seat-prompt.module.css', '.session'),
    rank('src/ui/seat-desktop.module.css', '.desktop'),
  ];
  for (const value of [...chrome, ...play]) assert.ok(value >= 0);
  assert.ok(Math.max(...chrome) < Math.min(...play));
});

test('màu nhấn của tiệm không dùng làm màu chữ', () => {
  for (const { path, css } of moduleSheets()) {
    assert.doesNotMatch(css, /(^|[;{\s])color\s*:\s*var\(--ui-accent\)/, path);
  }
});
