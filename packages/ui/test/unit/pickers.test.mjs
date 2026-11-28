import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseItem, rowNeighbor, stepNumber } from '../../src/pickers.mjs';

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

test('giá trị gõ vào bám theo bước và không cộng dồn sai số thập phân', () => {
  assert.equal(stepNumber(3, 0, { min: 0, max: 10, step: 2 }), 4);
  assert.equal(stepNumber(0.2, 1, { min: 0, max: 1, step: 0.1 }), 0.3);
  assert.equal(stepNumber(155, 0, { min: 150, max: 190, step: 1 }), 155);
  assert.equal(stepNumber(-5, 0, { min: 150, max: 190, step: 1 }), 150);
});

test('lưới đồ đi lên xuống theo cột, hàng cuối thiếu ô thì dừng ở ô cuối', () => {
  assert.equal(rowNeighbor(0, 10, 4, 1), 4);
  assert.equal(rowNeighbor(4, 10, 4, -1), 0);
  assert.equal(rowNeighbor(2, 10, 4, -1), 2);
  assert.equal(rowNeighbor(6, 10, 4, 1), 9);
  assert.equal(rowNeighbor(9, 10, 4, 1), 9);
  assert.equal(rowNeighbor(1, 4, 4, 1), 1);
  assert.equal(rowNeighbor(3, 10, 1, 1), 4);
});
