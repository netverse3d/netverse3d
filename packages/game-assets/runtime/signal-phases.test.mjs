import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCross, createJunctionPlan, signalStateAt } from './signal-phases.mjs';

const plan = createJunctionPlan({
  arms: ['west', 'north', 'east'],
  order: ['west', 'east', 'north'],
  green: 8,
  yellow: 2,
  allRed: 3,
  offset: 1,
  crossings: [
    { id: 'west-crossing', conflictingArms: ['west', 'north'] },
    { id: 'all-crossing', conflictingArms: ['west', 'east', 'north'] },
  ],
});

test('pha đèn tất định, có vàng và khoảng đỏ toàn phần qua nhiều chu kỳ', () => {
  assert.deepEqual(signalStateAt(plan, 7), signalStateAt(plan, 7));
  assert.equal(signalStateAt(plan, 0).arms.west.vehicle, 'green');
  assert.equal(signalStateAt(plan, 8).arms.west.vehicle, 'yellow');
  assert.ok(Object.values(signalStateAt(plan, 10).arms).every((arm) => arm.vehicle === 'red'));
  for (let t = 0; t < 600; t += 0.25) {
    const state = signalStateAt(plan, t);
    assert.ok(Object.values(state.arms).filter((arm) => arm.vehicle === 'green').length <= 1);
    assert.deepEqual(state, signalStateAt(plan, t + plan.duration * 6));
    assert.ok(Object.values(state.arms).every((arm) => arm.remaining > 0));
  }
});

test('cổng đi bộ chỉ mở khi tất cả nhánh xung đột đã đỏ', () => {
  assert.equal(canCross(plan, 'west-crossing', 0), false);
  assert.equal(canCross(plan, 'west-crossing', 13), true);
  assert.equal(canCross(plan, 'all-crossing', 13), false);
  assert.equal(canCross(plan, 'all-crossing', 10), true);
  assert.throws(() => canCross(plan, 'missing', 0));
});
