import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SIGNAL_BULB_NAMES, STREET_LAMP_LED_NAMES } from '../runtime/signal-look.mjs';
import { hasGlbHeader, readGlb } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('bản xuất traffic-parts.glb có đủ lưới con mà đèn tín hiệu và đèn đường cần', (context) => {
  const data = readFileSync(new URL('../exported/traffic-parts.glb', import.meta.url));
  if (!hasGlbHeader(data)) {
    context.skip('Cần mô hình Git LFS thật');
    return;
  }
  const gltf = readGlb(data);
  const parentOf = new Map();
  gltf.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) parentOf.set(child, index);
  });
  const required = [...SIGNAL_BULB_NAMES, ...STREET_LAMP_LED_NAMES];
  assert.ok(required.includes('signal_a_countdown'));
  assert.ok(required.includes('streetlight_a_led'));
  for (const name of required) {
    const index = gltf.nodes.findIndex((node) => node.name === name);
    assert.ok(index >= 0, `${name} is missing from traffic-parts.glb`);
    const node = gltf.nodes[index];
    assert.ok(Number.isInteger(node.mesh), `${name} has no mesh`);
    const materials = gltf.meshes[node.mesh].primitives.map(
      (primitive) => gltf.materials[primitive.material].name,
    );
    assert.deepEqual([...new Set(materials)], ['glow'], `${name} must only use glow`);
    const part = name.split('_').slice(0, 2).join('_');
    assert.equal(gltf.nodes[parentOf.get(index)]?.name, part, `${name} must hang under ${part}`);
  }
});

test('mọi trang thư viện dựng đèn đường từ bộ giao thông đều áp và giải phóng kiểu đèn đường', () => {
  for (const relativePath of [
    'library/lab.html',
    'library/shared/parts.mjs',
    'library/gallery.html',
  ]) {
    const source = readFileSync(join(ROOT, relativePath), 'utf8');
    assert.match(source, /signal-look\.mjs/, `${relativePath} must import signal-look.mjs`);
    assert.match(
      source,
      /createStreetLampLook\s*\(\s*THREE\s*,/,
      `${relativePath} must apply createStreetLampLook`,
    );
    assert.match(source, /lampLooks[\s\S]*\.dispose\(\)/, `${relativePath} must dispose lampLooks`);
  }
});
