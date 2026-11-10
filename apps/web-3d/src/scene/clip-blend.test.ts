import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CLIP_BLEND_SECONDS, blendClipWeights } from './clip-blend.ts';

const FRAME = 1 / 60;

function total(weights: ReadonlyMap<string, number>): number {
  return [...weights.values()].reduce((sum, weight) => sum + weight, 0);
}

function run(
  weights: ReadonlyMap<string, number>,
  clip: string,
  frames: number,
): Map<string, number> {
  let next = new Map(weights);
  for (let frame = 0; frame < frames; frame += 1) next = blendClipWeights(next, clip, FRAME);
  return next;
}

test('clip đầu tiên phát ngay ở trọng số đủ', () => {
  assert.deepEqual([...blendClipWeights(new Map(), 'idle', 0)], [['idle', 1]]);
});

test('đổi clip thì clip mới tăng dần, clip cũ giảm dần, tổng luôn bằng một', () => {
  const half = blendClipWeights(new Map([['idle', 1]]), 'walk', CLIP_BLEND_SECONDS / 2);
  assert.ok(Math.abs((half.get('walk') ?? 0) - 0.5) < 1e-9);
  assert.ok(Math.abs((half.get('idle') ?? 0) - 0.5) < 1e-9);
  assert.ok(Math.abs(total(half) - 1) < 1e-9);
});

test('hết thời gian chuyển thì chỉ còn clip mới', () => {
  const done = run(new Map([['idle', 1]]), 'walk', 30);
  assert.deepEqual([...done], [['walk', 1]]);
});

test('đổi ý giữa lúc đang chuyển thì trọng số đi tiếp từ chỗ đang dở, không giật', () => {
  const started = run(new Map([['idle', 1]]), 'walk', 3);
  const reversed = blendClipWeights(started, 'idle', FRAME);
  const step = FRAME / CLIP_BLEND_SECONDS;
  for (const clip of ['idle', 'walk']) {
    const moved = Math.abs((reversed.get(clip) ?? 0) - (started.get(clip) ?? 0));
    assert.ok(moved <= step + 1e-9, `${clip} jumped by ${moved}`);
  }
  assert.ok((reversed.get('idle') ?? 0) > (started.get('idle') ?? 0));
});

test('đổi liên tiếp qua ba clip thì tổng vẫn bằng một và không clip nào nhảy vọt', () => {
  let weights = run(new Map([['idle', 1]]), 'walk', 4);
  const step = FRAME / CLIP_BLEND_SECONDS;
  for (let frame = 0; frame < 20; frame += 1) {
    const next = blendClipWeights(weights, 'run', FRAME);
    assert.ok(Math.abs(total(next) - 1) < 1e-9, `total ${total(next)}`);
    for (const clip of ['idle', 'walk', 'run']) {
      const moved = Math.abs((next.get(clip) ?? 0) - (weights.get(clip) ?? 0));
      assert.ok(moved <= step + 1e-9, `${clip} jumped by ${moved}`);
    }
    weights = next;
  }
  assert.deepEqual([...weights], [['run', 1]]);
});

test('thời gian hỏng thì giữ nguyên trọng số', () => {
  const started = run(new Map([['idle', 1]]), 'walk', 3);
  for (const seconds of [Number.NaN, -1, Infinity]) {
    const next = blendClipWeights(started, 'walk', seconds);
    assert.ok(Math.abs((next.get('walk') ?? 0) - (started.get('walk') ?? 0)) < 1e-9, `${seconds}`);
  }
});
