import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { validateJsonSchema } from './lib.mjs';

const schema = JSON.parse(
  readFileSync(new URL('./world/v1/city-map.schema.json', import.meta.url)),
);
const validate = new Ajv2020({ strict: false }).compile(schema);
const map = {
  id: 'city',
  name: 'City',
  grid: 4,
  districts: [
    {
      id: 'district',
      name: 'District',
      origin: [0, 0],
      blocks: [{ ref: 'hem-mau', at: [0, 0], rotation: 0 }],
      roads: [
        { id: 'road', tier: 'alley', from: [0, 0], to: [0, 3], lanes: { forward: 1, backward: 1 } },
      ],
      junctions: [
        {
          id: 'junction',
          at: [0, 3],
          kind: 'tee',
          arms: [{ id: 'north', road: 'road', crossing: true, stopLine: 2 }],
          signal: null,
        },
      ],
      lots: [
        { id: 'lot', at: [1, 0], size: [1, 1], kind: 'empty', facing: 'north', components: [] },
      ],
    },
  ],
};

test('nhận schema và bản đồ hợp lệ', () => {
  assert.deepEqual(validateJsonSchema(schema, 'city-map'), []);
  assert.equal(validate(map), true, JSON.stringify(validate.errors));
});

for (const [name, mutate] of [
  [
    'cấp đường lạ',
    (v) => {
      v.districts[0].roads[0].tier = 'unknown';
    },
  ],
  [
    'góc xoay không hợp lệ',
    (v) => {
      v.districts[0].blocks[0].rotation = 45;
    },
  ],
  [
    'nút giao thiếu nhánh',
    (v) => {
      delete v.districts[0].junctions[0].arms;
    },
  ],
  [
    'lô có kích thước bằng không',
    (v) => {
      v.districts[0].lots[0].size[0] = 0;
    },
  ],
  [
    'trường thừa',
    (v) => {
      v.districts[0].extra = true;
    },
  ],
]) {
  test(`từ chối ${name}`, () => {
    const invalid = structuredClone(map);
    mutate(invalid);
    assert.equal(validate(invalid), false);
  });
}
