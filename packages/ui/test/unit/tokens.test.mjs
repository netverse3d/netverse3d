import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOLID_ACTIONS, TIMED_MOTION, TOKEN_GROUPS, catalogTokens } from '../../src/catalog.mjs';
import { contrastRatio } from '../../src/contrast.mjs';
import { readTokenRules } from '../../src/token-files.mjs';
import { parseTokenRules, resolveToken, tokenDefaults, tokenOverrides } from '../../src/tokens.mjs';

const rules = readTokenRules();
const defaults = tokenDefaults(rules);
const resolve = (name, values = defaults) => resolveToken(name, values);

function assertPairs(foregrounds, backgrounds, minimum) {
  for (const foreground of foregrounds) {
    for (const background of backgrounds) {
      const value = contrastRatio(resolve(foreground), resolve(background));
      assert.ok(value >= minimum, `${foreground} / ${background}: ${value.toFixed(2)}`);
    }
  }
}

test('đọc được khai báo token theo từng khối và từng media query', () => {
  const parsed = parseTokenRules(
    ':root { --ui-a: 1px; }\n@media (x) { :root { --ui-a: 0; } }\n:root[data-y] { --ui-b: var(--ui-a); }',
  );
  assert.deepEqual(
    parsed.map((rule) => [rule.media, rule.selector]),
    [
      ['(x)', ':root'],
      [null, ':root'],
      [null, ':root[data-y]'],
    ],
  );
  assert.equal(resolveToken('--ui-b', { '--ui-a': '1px', '--ui-b': 'var(--ui-a)' }), '1px');
});

test('chữ chính trên mọi mặt nền đạt tương phản 4.5:1', () => {
  assertPairs(TOKEN_GROUPS.text, TOKEN_GROUPS.surfaces, 4.5);
  assertPairs(['--ui-on-action'], SOLID_ACTIONS, 4.5);
});

test('viền focus, viền điều khiển và màu trạng thái đạt 3:1 trên mặt nền', () => {
  assertPairs(TOKEN_GROUPS.indicators, TOKEN_GROUPS.surfaces, 3);
});

test('đổi accent tiệm không đổi màu trạng thái lỗi', () => {
  const shop = { ...defaults, '--ui-accent': '#ff6f3c' };
  for (const token of ['--ui-error', '--ui-warning', '--ui-success', '--ui-focus', '--ui-text']) {
    assert.equal(resolve(token, shop), resolve(token), token);
  }
});

test('khi người dùng chọn giảm chuyển động, mọi thời lượng về 0', () => {
  const reducedByOs = {
    ...defaults,
    ...tokenOverrides(rules, (rule) => /prefers-reduced-motion/.test(rule.media ?? '')),
  };
  const reducedByPage = {
    ...defaults,
    ...tokenOverrides(rules, (rule) => rule.selector.includes("data-ui-motion='reduced'")),
  };
  for (const values of [reducedByOs, reducedByPage]) {
    for (const token of TIMED_MOTION) assert.equal(resolve(token, values), '0ms', token);
  }
  assert.notEqual(resolve('--ui-motion-base'), '0ms');
});

test('mức chất lượng thấp hoặc giảm trong suốt dùng nền đặc thay kính', () => {
  const cases = [
    (rule) => rule.selector.includes("data-ui-quality='low'"),
    (rule) => rule.selector.includes("data-ui-transparency='reduced'"),
    (rule) => /prefers-reduced-transparency/.test(rule.media ?? ''),
  ];
  for (const matches of cases) {
    const values = { ...defaults, ...tokenOverrides(rules, matches) };
    assert.equal(resolve('--ui-panel', values), resolve('--ui-surface'));
    assert.equal(resolve('--ui-panel-filter', values), 'none');
  }
  assert.equal(resolve('--ui-panel'), resolve('--ui-surface-glass'));
});

test('danh mục token khớp đúng các token đã khai', () => {
  assert.deepEqual([...catalogTokens()].sort(), Object.keys(defaults).sort());
});
