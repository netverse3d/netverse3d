import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  STREET_CELL,
  STOREY_HEIGHT,
  facadePlacements,
  lotFrontage,
  missingParts,
  propPlacements,
  roadLane,
  sidewalkWaypoints,
  streetPlan,
  wirePlacements,
} from './street-look.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const SAMPLE = readJson(join(ROOT, 'blocks/hem-mau.json'));
const SCHEMA = readJson(join(ROOT, '../contracts/world/street-block.v1.schema.json'));
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

test('vỉa hè bám cạnh ô phía phố và lô quay mặt ra hẻm', () => {
  const walk = streetPlan(BLOCK).find((item) => item.slot === 'sidewalk');
  assert.deepEqual(walk.position, [-4, 0, 0.5]);
  const front = lotFrontage(BLOCK.lots[0], BLOCK);
  assert.deepEqual(front.centre, [-2, 4]);
  assert.equal(front.yaw, 0);
  const north = lotFrontage({ id: 'n', cell: [0, 0], facing: 'north' }, BLOCK);
  assert.deepEqual(north.centre, [-2, -4]);
  assert.equal(north.yaw, Math.PI);
});

test('mỗi lô dựng hai cột mặt tiền 4 m: trệt, các lầu theo danh sách rồi mái, cao mỗi tầng 3,4 m', () => {
  const stack = facadePlacements(BLOCK);
  assert.equal(stack.length, 8);
  const column = stack
    .filter((item) => item.position[0] === -4)
    .map((item) => [item.part, item.position[1]]);
  assert.deepEqual(column, [
    ['shopfront_a', 0],
    ['storey_a', STOREY_HEIGHT],
    ['storey_b', STOREY_HEIGHT * 2],
    ['roof_a', STOREY_HEIGHT * 3],
  ]);
  assert.ok(stack.every((item) => item.lot === 'lo' && item.position[2] === 4 && item.yaw === 0));
});

test('đồ của khối đặt theo mét từ góc tây-bắc, đồ của lô đặt so với tâm mép phố và quay theo lô', () => {
  const props = propPlacements({
    ...BLOCK,
    props: [{ slot: 'lamp', at: [1, 1], facing: 'west' }],
    lots: [{ id: 'lo', cell: [0, 0], facing: 'south', props: [{ slot: 'bin', at: [1, 0.5] }] }],
  });
  assert.deepEqual(props[0], {
    slot: 'lamp',
    part: 'lamp_a',
    position: [-5, 0, -3],
    yaw: -Math.PI / 2,
  });
  assert.deepEqual(props[1], { slot: 'bin', part: 'bin_a', position: [-1, 0, 4.5], yaw: 0 });
});

test('dây điện chỉ nối hai cột cùng hàng cách đúng một ô', () => {
  const poles = propPlacements(BLOCK).filter((item) => item.slot === 'pole');
  const wires = wirePlacements(poles, BLOCK);
  assert.deepEqual(
    wires.map((wire) => [wire.part, wire.position]),
    [['wires_a', [-2, 0, 1.5]]],
  );
  assert.equal(streetPlan(BLOCK).filter((item) => item.slot === 'wires').length, 1);
});

test('điểm chờ vỉa hè và làn đường lấy từ kế hoạch', () => {
  assert.deepEqual(sidewalkWaypoints(BLOCK), [[-4, 0.5]]);
  assert.deepEqual(roadLane(BLOCK), [
    [-4, 2],
    [0, 2],
    [4, 2],
  ]);
});

test('khối phố mẫu chỉ dùng món có trong bộ phố', () => {
  assert.deepEqual(missingParts(streetPlan(SAMPLE), STREET_KIT), []);
  assert.deepEqual(missingParts([{ part: 'tower_a' }], STREET_KIT), ['tower_a']);
  assert.equal(STREET_CELL, 4);
});
