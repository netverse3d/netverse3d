import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  SIDEWALK_TOP,
  STREET_CELL,
  blockIssues,
  facadePlacements,
  lotFrontage,
  missingParts,
  propPlacements,
  roadLane,
  sidewalkPlacements,
  sidewalkWaypoints,
  streetPlan,
  wirePlacements,
} from './street-look.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const SAMPLE = readJson(join(ROOT, 'blocks/hem-mau.json'));
const SCHEMA = readJson(join(ROOT, '../contracts/world/v1/street-block.schema.json'));
const CONFIG = readJson(join(ROOT, 'assets.config.json'));
const STREET_KIT = CONFIG.kits.find((kit) => kit.file === 'street-parts.glb');

const BLOCK = {
  id: 'thu',
  name: 'Thử',
  cells: [3, 2],
  roads: [
    { cell: [0, 1], kind: 'straight' },
    { cell: [1, 1], kind: 'straight' },
    { cell: [2, 1], kind: 'corner', facing: 'east' },
  ],
  sidewalks: [{ cell: [0, 1], side: 'north' }],
  lots: [{ id: 'lo', cell: [0, 0], facing: 'south', storeys: ['a', 'b'], roof: 'a' }],
  props: [
    { slot: 'pole', at: [2, 5.5] },
    { slot: 'pole', at: [6, 5.5] },
    { slot: 'pole', at: [10, 2] },
  ],
};

test('khối phố mẫu đúng hợp đồng street-block.v1', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(SCHEMA);
  assert.equal(validate(SAMPLE), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...SAMPLE, lots: [{ id: 'x', cell: [0, 0] }] }), false);
});

test('ô đường đặt đúng tâm ô 4 m, biến thể theo kiểu rãnh và quay theo hướng', () => {
  const roads = streetPlan(BLOCK).filter((item) => item.slot === 'road');
  assert.deepEqual(
    roads.map((road) => [road.part, road.position, road.yaw]),
    [
      ['road_a', [-4, 0, 2], 0],
      ['road_a', [0, 0, 2], 0],
      ['road_b', [4, 0, 2], Math.PI / 2],
    ],
  );
});

test('vỉa hè bám cạnh ô phía lô, quay bó vỉa ra đường, và lô quay mặt ra hẻm', () => {
  const walk = streetPlan(BLOCK).find((item) => item.slot === 'sidewalk');
  assert.deepEqual([walk.position, walk.yaw], [[-4, 0, 0.5], 0]);
  const front = lotFrontage(BLOCK.lots[0], BLOCK);
  assert.deepEqual(front.centre, [-2, 4]);
  assert.equal(front.yaw, 0);
  const north = lotFrontage({ id: 'n', cell: [0, 0], facing: 'north' }, BLOCK);
  assert.deepEqual(north.centre, [-2, -4]);
  assert.equal(north.yaw, Math.PI);
});

test('mỗi lô dựng hai cột mặt tiền 4 m: trệt, các lầu theo thứ tự rồi mái, cao mỗi tầng 3,8 m', () => {
  const stack = facadePlacements(BLOCK);
  assert.equal(stack.length, 8);
  const column = stack
    .filter((item) => item.position[0] === -4)
    .map((item) => [item.part, item.position[1]]);
  assert.deepEqual(column, [
    ['shopfront_a', 0],
    ['storey_a', 3.8],
    ['storey_b', 7.6],
    ['roof_a', 11.4],
  ]);
  assert.ok(stack.every((item) => item.lot === 'lo' && item.position[2] === 4 && item.yaw === 0));
});

test('đồ của khối đặt theo mét từ góc tây-bắc, đồ của lô đặt so với tâm mép phố, đều đứng trên mặt vỉa hè', () => {
  const props = propPlacements({
    ...BLOCK,
    props: [{ slot: 'lamp', at: [1, 1], facing: 'west' }],
    lots: [{ id: 'lo', cell: [0, 0], facing: 'south', props: [{ slot: 'bin', at: [1, 0.5] }] }],
  });
  assert.deepEqual(props[0], {
    slot: 'lamp',
    part: 'lamp_a',
    position: [-5, SIDEWALK_TOP, -3],
    yaw: -Math.PI / 2,
  });
  assert.deepEqual(props[1], {
    slot: 'bin',
    part: 'bin_a',
    position: [-1, SIDEWALK_TOP, 4.5],
    yaw: 0,
  });
});

test('lô quay mặt sang east đặt cột mặt tiền dọc trục z, đồ trước cửa đi theo chiều trái phải của nhà', () => {
  const east = {
    ...BLOCK,
    lots: [{ id: 'e', cell: [0, 0], facing: 'east', props: [{ slot: 'bin', at: [1, 0.5] }] }],
  };
  const stack = facadePlacements(east);
  const columns = [
    ...new Set(stack.map((item) => `${item.position[0]},${item.position[2]}`)),
  ].sort();
  assert.deepEqual(columns, ['2,-2', '2,2']);
  assert.ok(stack.every((item) => item.yaw === Math.PI / 2));
  const bin = propPlacements(east).find((item) => item.slot === 'bin');
  assert.deepEqual(bin.position, [2.5, SIDEWALK_TOP, -1]);
  const walk = sidewalkPlacements({ ...BLOCK, sidewalks: [{ cell: [2, 0], side: 'west' }] })[0];
  assert.deepEqual([walk.position, walk.yaw], [[2.5, 0, -2], Math.PI / 2]);
});

test('dây điện nối hai cột cách đúng một ô, dọc trục x hay trục z', () => {
  const poles = propPlacements(BLOCK).filter((item) => item.slot === 'pole');
  const wires = wirePlacements(poles, BLOCK);
  assert.deepEqual(
    wires.map((wire) => [wire.part, wire.position, wire.yaw]),
    [['wires_a', [-2, SIDEWALK_TOP, 1.5], 0]],
  );
  assert.equal(streetPlan(BLOCK).filter((item) => item.slot === 'wires').length, 1);
  const column = wirePlacements(
    [
      { slot: 'pole', position: [3, SIDEWALK_TOP, -2] },
      { slot: 'pole', position: [3, SIDEWALK_TOP, 2] },
      { slot: 'pole', position: [3, SIDEWALK_TOP, 7] },
    ],
    BLOCK,
  );
  assert.deepEqual(
    column.map((wire) => [wire.position, wire.yaw]),
    [[[3, SIDEWALK_TOP, 0], Math.PI / 2]],
  );
});

test('điểm chờ vỉa hè và làn đường lấy từ kế hoạch', () => {
  assert.deepEqual(sidewalkWaypoints(BLOCK), [[-4, 0.5]]);
  assert.deepEqual(roadLane(BLOCK), [
    [-4, 2],
    [0, 2],
    [4, 2],
  ]);
});

test('khối phố mẫu không có lô lấn đường hay ra ngoài khối, cột và đèn đứng trên dải vỉa hè', () => {
  assert.deepEqual(blockIssues(SAMPLE, STREET_KIT), []);
  const strips = sidewalkPlacements(SAMPLE).map((walk) => walk.position);
  const standing = propPlacements(SAMPLE).filter((item) => ['pole', 'lamp'].includes(item.slot));
  assert.ok(standing.length >= 2);
  for (const prop of standing) {
    assert.ok(
      strips.some(
        (strip) =>
          Math.abs(strip[2] - prop.position[2]) <= 0.5 &&
          Math.abs(strip[0] - prop.position[0]) <= 2,
      ),
      `${prop.part} at ${prop.position} is off the sidewalk`,
    );
  }
  const broken = {
    ...SAMPLE,
    lots: [
      { id: 'a', cell: [0, 1], facing: 'south' },
      { id: 'b', cell: [1, 1], facing: 'south' },
      { id: 'c', cell: [3, 0], facing: 'south' },
    ],
  };
  assert.deepEqual(blockIssues(broken, STREET_KIT), [
    'lot a covers road cell 0,2',
    'lot a covers road cell 1,2',
    'lot b overlaps lot a at 1,1',
    'lot b covers road cell 1,2',
    'lot b overlaps lot a at 1,2',
    'lot b covers road cell 2,2',
    'lot c leaves the block',
  ]);
});

test('khối phố mẫu chỉ dùng món có trong bộ phố', () => {
  assert.deepEqual(missingParts(streetPlan(SAMPLE), STREET_KIT), []);
  assert.deepEqual(missingParts([{ part: 'tower_a' }], STREET_KIT), ['tower_a']);
  assert.equal(STREET_CELL, 4);
});
