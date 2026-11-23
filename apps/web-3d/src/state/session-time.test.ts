import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as shopState from './shop-slice.ts';

test('đồng hồ còn lại làm tròn xuống và không xuống dưới không', () => {
  const calculate = Reflect.get(shopState, 'remainingSeconds') as
    ((endsAt: number, now: number, offset: number) => number) | undefined;
  assert.equal(typeof calculate, 'function');
  if (!calculate) return;
  assert.equal(calculate(60_000, 999, 0), 59);
  assert.equal(calculate(60_000, 1_000, 500), 58);
  assert.equal(calculate(60_000, 60_000, 0), 0);
  assert.equal(calculate(60_000, 61_000, 0), 0);
});
