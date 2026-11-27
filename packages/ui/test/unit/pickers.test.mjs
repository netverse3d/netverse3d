import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseItem, stepNumber } from '../../src/pickers.mjs';

const ITEMS = [{ id: 'hoodie', locked: false }, { id: 'jacket', locked: true }, { id: 'cap' }];

test('ô đồ khoá không chọn được', () => {
  assert.equal(chooseItem(ITEMS, 'hoodie', 'jacket'), 'hoodie');
  assert.equal(chooseItem(ITEMS, 'hoodie', 'cap'), 'cap');
  assert.equal(chooseItem(ITEMS, null, 'jacket'), null);
  assert.equal(chooseItem(ITEMS, 'cap', 'missing'), 'cap');
});

test('ô tăng giảm số dừng ở biên và đi đúng bước', () => {
  const range = { min: 0, max: 10, step: 2 };
  assert.equal(stepNumber(4, 1, range), 6);
  assert.equal(stepNumber(10, 1, range), 10);
  assert.equal(stepNumber(0, -1, range), 0);
  assert.equal(stepNumber(9, 1, range), 10);
  assert.equal(stepNumber(Number.NaN, 1, range), 0);
});
