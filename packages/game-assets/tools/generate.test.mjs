import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildShowcasePlan } from '../pipeline/showcase_plan.mjs';
import { blenderEnvironment, generateOptions } from './generate.mjs';
import { isLfsPointer, loadConfig } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(ROOT);
const scripted = [...config.kits, ...(config.scenes ?? [])].filter((entry) => entry.generator);

test('tệp gốc sinh từ script trỏ tới script có trong repo', () => {
  assert.ok(scripted.length >= 3);
  for (const entry of scripted) {
    assert.ok(
      existsSync(join(ROOT, entry.generator)),
      `${entry.source}: ${entry.generator} missing`,
    );
  }
});

test('cờ --preview tách khỏi tên bộ và bật biến môi trường bỏ nướng cho Blender', () => {
  assert.deepEqual(generateOptions(['parts-lounge', '--preview']), {
    wanted: new Set(['parts-lounge']),
    preview: true,
  });
  assert.deepEqual(generateOptions([]), { wanted: new Set(), preview: false });
  assert.deepEqual(blenderEnvironment(true), { ASSET_PREVIEW: '1' });
  assert.deepEqual(blenderEnvironment(false), {});
});

test('script sinh không chứa đường dẫn tuyệt đối tới máy người dùng', () => {
  const pattern = /[A-Za-z]:[\\/]Users[\\/]|\/home\/[a-z]|\/Users\/[a-z]/;
  for (const file of readdirSync(join(ROOT, 'pipeline'))) {
    if (!/\.(py|mjs)$/.test(file)) continue;
    const text = readFileSync(join(ROOT, 'pipeline', file), 'utf8');
    assert.equal(pattern.test(text), false, `${file} hard-codes a user path`);
  }
});

const exportedPointers = ['station-parts.glb', 'room-kit.glb'].some((file) =>
  isLfsPointer(readFileSync(join(ROOT, 'exported', file))),
);

test(
  'kế hoạch tiệm giới thiệu đặt ba máy quay mặt về bắc trong phòng hở',
  { skip: exportedPointers },
  () => {
    const plan = buildShowcasePlan(ROOT, 'tim-neon');
    assert.equal(plan.recipe, 'tim-neon');
    assert.deepEqual(plan.cells, [3, 2]);
    assert.equal(plan.stations.filter((p) => p.slot === 'desk').length, 3);
    assert.ok(plan.room.some((p) => p.slot === 'window'));
    assert.equal(plan.room.filter((p) => p.slot === 'floor').length, 6);
    assert.ok(plan.room.every((p) => !['ceiling', 'light', 'door'].includes(p.slot)));
  },
);
