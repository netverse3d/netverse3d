import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('thanh môi trường và bloom cùng cập nhật preset ánh sáng', () => {
  const html = readFileSync(resolve(ROOT, 'library/lab.html'), 'utf8');
  const match = html.match(/const sliders = \{([\s\S]*?)\n {6}\};/);
  assert.ok(match, 'Không tìm thấy bộ thanh trượt ánh sáng');
  const updates = [];
  const activeBloom = { strength: 0.35, radius: 0.4, threshold: 0.85 };
  const bloom = { ...activeBloom };
  const sliders = runInNewContext(`({${match[1]}})`, {
    bloom,
    lightingHandle: {
      update(value) {
        updates.push(value);
        if (value.bloom) Object.assign(activeBloom, value.bloom);
        Object.assign(bloom, activeBloom);
      },
    },
  });

  sliders.bloomStrength(1.2);
  sliders.bloomThreshold(0.2);
  sliders.env(0.2);

  assert.deepEqual(JSON.parse(JSON.stringify(updates)), [
    { bloom: { strength: 1.2 } },
    { bloom: { threshold: 0.2 } },
    { environment: { intensity: 0.2 } },
  ]);
  assert.equal(bloom.strength, 1.2);
  assert.equal(bloom.threshold, 0.2);
});
