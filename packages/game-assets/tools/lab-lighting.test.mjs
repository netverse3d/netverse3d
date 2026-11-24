import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { applyLighting, LIGHTING_PRESETS } from '../runtime/lighting.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('thanh môi trường và bloom cùng cập nhật preset ánh sáng', () => {
  const html = readFileSync(resolve(ROOT, 'library/lab.html'), 'utf8');
  const match = html.match(/const sliders = \{([\s\S]*?)\n {6}\};/);
  assert.ok(match, 'Không tìm thấy bộ thanh trượt ánh sáng');
  const updates = [];
  const scene = new THREE.Scene();
  const bloomPass = {};
  const lighting = applyLighting(THREE, {
    scene,
    renderer: {},
    bloomPass,
    preset: {
      ...LIGHTING_PRESETS['shop-neon'],
      environment: { source: 'none', intensity: 0.3, blur: 0 },
    },
  });
  const sliders = runInNewContext(`({${match[1]}})`, {
    bloom: bloomPass,
    lightingHandle: {
      update(value) {
        updates.push(value);
        lighting.update(value);
      },
      setExposure(value) {
        lighting.setExposure(value);
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
  assert.equal(bloomPass.strength, 1.2);
  assert.equal(bloomPass.threshold, 0.2);
  assert.equal(lighting.preset.environment.intensity, 0.2);
  lighting.dispose();
});
