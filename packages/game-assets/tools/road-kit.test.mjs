import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SIDEWALK_TOP, STREET_CELL } from '../runtime/street-look.mjs';
import {
  connectedComponents,
  coplanarOverlaps,
  partTriangles,
  placeTriangles,
  readAccessor,
} from './coplanar.mjs';
import { checkModel, isLfsPointer, loadConfig, readGlb, readGlbBinary } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function partBounds(gltf, bin, name) {
  const triangles = partTriangles(gltf, bin, name);
  assert.ok(triangles.length > 0, `${name} has no triangles`);
  const bounds = [0, 1, 2].map(() => ({ min: Infinity, max: -Infinity }));
  for (const triangle of triangles) {
    for (const point of triangle) {
      for (const axis of [0, 1, 2]) {
        bounds[axis].min = Math.min(bounds[axis].min, point[axis]);
        bounds[axis].max = Math.max(bounds[axis].max, point[axis]);
      }
    }
  }
  return bounds;
}

function labSets(html) {
  const match = html.match(/const SETS = (\{[\s\S]*?\n {6}\});/);
  assert.ok(match, 'SETS not found in library/lab.html');
  return new Function(
    'PARK_EXHIBIT',
    'VACANT_PLOT_EXHIBIT',
    'ALLEY_PROPS_EXHIBIT',
    `return ${match[1]}`,
  )([], [], []);
}

test('cấu hình đăng ký bộ đường lớn với bốn ô chuẩn, ngân sách và lưới 4 m', () => {
  const config = loadConfig(ROOT);
  const kit = config.kits.find((entry) => entry.file === 'road-parts.glb');
  assert.ok(kit, 'road-parts.glb is missing from assets.config.json');
  assert.equal(kit.source, 'parts-road.blend');
  assert.equal(kit.generator, 'pipeline/make_road_kit.py');
  assert.equal(kit.lightmap, true);

  assert.deepEqual(Object.keys(kit.slots).sort(), ['lane', 'mark', 'median', 'verge']);
  assert.deepEqual(kit.slots.lane.variants, ['a', 'b', 'c']);
  assert.equal(kit.slots.lane.maxTriangles, 300);
  assert.deepEqual(kit.slots.lane.grid, { size: STREET_CELL, axes: [0, 2] });

  assert.deepEqual(kit.slots.median.variants, ['a', 'b']);
  assert.equal(kit.slots.median.maxTriangles, 500);
  assert.deepEqual(kit.slots.median.grid, { size: STREET_CELL, axes: [0] });
  assert.ok(kit.slots.median.anchors?.includes('collision_main'));

  assert.deepEqual(kit.slots.verge.variants, ['a']);
  assert.deepEqual(kit.slots.verge.grid, { size: STREET_CELL, axes: [0] });

  assert.ok(kit.slots.mark.variants.length >= 3);
});

test('thư viện xếp bộ đường lớn vào mục Phố và có tên tiếng Việt cho bộ và các ô', () => {
  const sections = JSON.parse(readFileSync(join(ROOT, 'library/shared/sections.json'), 'utf8'));
  const text = JSON.parse(readFileSync(join(ROOT, 'library/shared/text.json'), 'utf8'));
  const street = sections.find((section) => section.id === 'street');
  assert.ok(street?.kits?.includes('road-parts.glb'));
  assert.ok(text.parts.kits['road-parts.glb']);
  for (const slot of ['lane', 'median', 'verge', 'mark']) {
    assert.ok(text.parts.slots[slot], `missing Vietnamese label for ${slot}`);
  }
});

test('phòng lab có đủ hai bộ ghép đường hai làn 8 m và đại lộ 16 m nối hẻm kèm nhân vật', () => {
  const sets = labSets(readFileSync(join(ROOT, 'library/lab.html'), 'utf8'));
  const entries = Object.values(sets).filter((items) =>
    items.some(([name]) => name.startsWith('lane_')),
  );
  assert.ok(entries.length >= 2, 'expected two road lab assemblies');

  const withMedian = entries.find((items) => items.some(([name]) => name.startsWith('median_')));
  const withoutMedian = entries.find(
    (items) => !items.some(([name]) => name.startsWith('median_')),
  );
  assert.ok(withoutMedian, 'expected an 8 m two-lane assembly');
  assert.ok(withMedian, 'expected a 16 m avenue assembly with median');

  for (const items of [withoutMedian, withMedian]) {
    assert.ok(items.some(([name]) => name.startsWith('verge_')));
    assert.ok(items.some(([name]) => name.startsWith('mark_')));
    assert.ok(items.some(([name]) => name.startsWith('road_')));
    assert.ok(items.some(([name]) => name.startsWith('sidewalk_')));
    assert.ok(items.some(([name]) => name === 'player'));

    const alleyRoads = items.filter(([name]) => name.startsWith('road_'));
    const alleyWalks = items.filter(([name]) => name.startsWith('sidewalk_'));
    const verges = items.filter(([name]) => name.startsWith('verge_'));
    const alleyZMin = Math.min(...alleyRoads.map(([, [, , z]]) => z - 2));
    const alleyZMax = Math.max(...alleyRoads.map(([, [, , z]]) => z + 2));
    const vergeBackZ = Math.min(...verges.map(([, [, , z]]) => z - 1));
    for (const [, [wx, , wz]] of alleyWalks) {
      assert.ok(wz - 2 >= alleyZMin, 'vỉa hè hẻm không được thò ra ngoài đường road_a');
      assert.ok(wz + 2 <= alleyZMax, 'vỉa hè hẻm phải nằm gọn dọc đường road_a');
      assert.equal(wz + 2, vergeBackZ, 'đầu vỉa hè hẻm phải khít mép sau của verge_a');
      assert.ok(Math.abs(wx) >= 2.5, 'vỉa hè hẻm không được lấn vào mặt đường road_a');
    }
  }

  const avenueLaneZs = new Set(
    withMedian.filter(([name]) => name.startsWith('lane_')).map(([, [, , z]]) => z),
  );
  assert.equal(avenueLaneZs.size, 4, '16 m avenue should span 4 lanes across');
});

test('bộ đường lớn xuất ra đạt kích thước, cao độ vỉa hè, độ nổi vạch kẻ và không trùng mặt đồng phẳng', (context) => {
  const roadPath = join(ROOT, 'exported/road-parts.glb');
  assert.ok(existsSync(roadPath), 'exported/road-parts.glb is missing');
  const roadBuffer = readFileSync(roadPath);
  if (isLfsPointer(roadBuffer)) return context.skip('road-parts.glb chưa tải nội dung LFS');

  const config = loadConfig(ROOT);
  const kit = config.kits.find((entry) => entry.file === 'road-parts.glb');
  assert.ok(kit);
  const gltf = readGlb(roadBuffer);
  const bin = readGlbBinary(roadBuffer);

  const expected = {
    file: kit.file,
    kit: true,
    lightmap: kit.lightmap === true,
    meshes: Object.fromEntries(
      Object.entries(kit.slots).flatMap(([slot, spec]) =>
        spec.variants.map((variant) => [`${slot}_${variant}`, spec.maxTriangles]),
      ),
    ),
    attributes: Object.fromEntries(
      Object.entries(kit.slots).flatMap(([slot, spec]) =>
        spec.variants.map((variant) => [`${slot}_${variant}`, ['TEXCOORD_1']]),
      ),
    ),
    anchors: Object.fromEntries(
      Object.entries(kit.slots).flatMap(([slot, spec]) =>
        spec.variants.map((variant) => [`${slot}_${variant}`, spec.anchors ?? []]),
      ),
    ),
    sizes: Object.fromEntries(
      Object.entries(kit.slots).flatMap(([slot, spec]) =>
        spec.variants.map((variant) => [`${slot}_${variant}`, spec.size]),
      ),
    ),
    grids: Object.fromEntries(
      Object.entries(kit.slots).flatMap(([slot, spec]) =>
        spec.variants.map((variant) => [`${slot}_${variant}`, spec.grid]),
      ),
    ),
    palette: config.palette,
  };
  assert.deepEqual(checkModel(kit.file, gltf, expected, bin), []);

  for (const variant of kit.slots.lane.variants) {
    const bounds = partBounds(gltf, bin, `lane_${variant}`);
    assert.ok(bounds[1].max >= 0 && bounds[1].max <= 0.005, `lane_${variant} road surface top`);
  }

  for (const variant of kit.slots.verge.variants) {
    const bounds = partBounds(gltf, bin, `verge_${variant}`);
    assert.ok(
      Math.abs(bounds[1].max - SIDEWALK_TOP) < 0.002,
      `verge_${variant} top ${bounds[1].max} != ${SIDEWALK_TOP}`,
    );
    assert.ok(Math.abs(bounds[1].min) < 0.002, `verge_${variant} base ${bounds[1].min} != 0`);
    assert.ok(
      Math.abs(bounds[2].max - bounds[2].min - 2.0) < 0.01,
      `verge_${variant} depth != 2 m`,
    );
    const topPerimeter = partTriangles(gltf, bin, `verge_${variant}`)
      .flat()
      .filter(([x, y, z]) => y > SIDEWALK_TOP - 0.015 && (Math.abs(x) > 1.98 || z < -0.98));
    assert.ok(topPerimeter.length > 0, `verge_${variant} thiếu mép trên tiếp giáp`);
    assert.ok(
      topPerimeter.some(([, y, z]) => z < -0.98 && Math.abs(y - SIDEWALK_TOP) < 0.003),
      `verge_${variant} mép sau tiếp giáp vỉa hè hẻm bị tụt bậc`,
    );
    assert.ok(
      topPerimeter.some(([x, y]) => Math.abs(x) > 1.98 && Math.abs(y - SIDEWALK_TOP) < 0.003),
      `verge_${variant} mép đầu hông bị tụt bậc`,
    );
  }

  for (const variant of kit.slots.lane.variants) {
    const node = gltf.nodes.find((entry) => entry.name === `lane_${variant}`);
    const uvs = gltf.meshes[node.mesh].primitives.flatMap((primitive) =>
      readAccessor(gltf, bin, primitive.attributes.TEXCOORD_0),
    );
    const rows = new Set(uvs.map(([, v]) => Math.round(v * 1000)));
    assert.ok(rows.size >= 3, `lane_${variant} cần biến thiên vật liệu mặt đường và vệt bánh xe`);
  }

  const markDComponents = new Set(connectedComponents(partTriangles(gltf, bin, 'mark_d')));
  assert.ok(
    markDComponents.size >= 3,
    'mark_d phải tách rõ hai bánh xe và thân xe tay ga để đọc được từ xa',
  );

  for (const variant of kit.slots.mark.variants) {
    const bounds = partBounds(gltf, bin, `mark_${variant}`);
    assert.ok(
      bounds[1].min >= 0.0019,
      `mark_${variant} bottom ${bounds[1].min} must float >= 2 mm above road`,
    );
  }

  const streetBuffer = readFileSync(join(ROOT, 'exported/street-parts.glb'));
  if (isLfsPointer(streetBuffer)) return context.skip('street-parts.glb chưa tải nội dung LFS');
  const streetGltf = readGlb(streetBuffer);
  const streetBin = readGlbBinary(streetBuffer);

  const sets = labSets(readFileSync(join(ROOT, 'library/lab.html'), 'utf8'));
  const roadSets = Object.entries(sets).filter(([, items]) =>
    items.some(([name]) => name.startsWith('lane_')),
  );
  for (const [name, items] of roadSets) {
    const placements = items
      .filter(([part]) => part !== 'player')
      .map(([part, pos, yaw], index) => {
        const tris = partTriangles(gltf, bin, part);
        const source = tris.length > 0 ? tris : partTriangles(streetGltf, streetBin, part);
        assert.ok(source.length > 0, `${name}: missing ${part}`);
        return { label: `${part}#${index}`, triangles: placeTriangles(source, pos, yaw) };
      });
    assert.deepEqual(coplanarOverlaps(placements, { acrossOnly: true }), [], name);
  }
});
