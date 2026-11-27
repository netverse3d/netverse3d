import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isClaimedKey, isWidgetKey } from '../../src/keys.mjs';

function keyFrom(target, prevented = false) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  if (prevented) event.preventDefault();
  return event;
}

function insideRole(role) {
  return {
    tagName: 'DIV',
    closest: (selector) => (selector.includes(`[role="${role}"]`) ? {} : null),
  };
}

test('phím gõ trong ô nhập hay đến từ mục của ô chọn thuộc về ô đó', () => {
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA'])
    assert.equal(isWidgetKey(keyFrom({ tagName })), true);
  for (const role of ['option', 'combobox', 'radio', 'switch', 'menuitem'])
    assert.equal(isWidgetKey(keyFrom(insideRole(role))), true, role);
  assert.equal(isWidgetKey(keyFrom({ tagName: 'BUTTON', closest: () => null })), false);
});

test('Enter và Esc đã được ô chọn đang mở xử lý thì hộp thuê máy không nhận', () => {
  assert.equal(isClaimedKey(keyFrom({ tagName: 'BODY', closest: () => null }, true)), true);
  assert.equal(isClaimedKey(keyFrom(insideRole('option'))), true);
  assert.equal(isClaimedKey(keyFrom({ tagName: 'BODY', closest: () => null })), false);
});
