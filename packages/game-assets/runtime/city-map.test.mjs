import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cityMapIssues, cityPlan, junctionPlanFor, mapBounds, stopLinesFor } from './city-map.mjs';
import { createJunctionPlan, canCross } from './signal-phases.mjs';
import { streetPlan } from './street-look.mjs';
import { createTrafficLane } from './traffic.mjs';

const block = JSON.parse(readFileSync(new URL('../blocks/hem-mau.json', import.meta.url)));
const config = JSON.parse(readFileSync(new URL('../assets.config.json', import.meta.url)));
const blocks = { 'hem-mau': block };
const map = {
  id: 'test',
  name: 'Test',
  grid: 4,
  districts: [
    {
      id: 'd',
      name: 'D',
      origin: [0, 0],
      blocks: [{ ref: 'hem-mau', at: [0, 0], rotation: 0 }],
      roads: [],
      junctions: [],
      lots: [],
    },
  ],
};

test('lắp khối phố từ cùng nguồn đặt thành phần', () => {
  const result = cityPlan(map, { blocks });
  assert.equal(result.placements.length, streetPlan(block).length);
  assert.equal(result.pendingPlacements.length, 0);
});

test('phát hiện khối không tồn tại cùng đường dẫn', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].blocks[0].ref = 'missing';
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some(
      (issue) => issue.code === 'block-missing' && issue.path.includes('blocks'),
    ),
  );
});

test('vạch qua đường an toàn khi các nhánh xung đột cùng đỏ', () => {
  const junction = {
    arms: [
      { id: 'west', crossing: true },
      { id: 'east', crossing: false },
      { id: 'north', crossing: false },
    ],
    signal: { order: ['west', 'east', 'north'], green: 8, yellow: 2, allRed: 3, offset: 0 },
  };
  const plan = createJunctionPlan(junctionPlanFor(junction));
  assert.equal(canCross(plan, 'west', 1), false);
  assert.equal(canCross(plan, 'west', 27), true);
});

test('tính được giới hạn bao quanh khối', () => {
  const bounds = mapBounds(map, { blocks });
  assert.ok(bounds.maxX > bounds.minX && bounds.maxZ > bounds.minZ);
});

test('báo từng loại sai lệch bản đồ tại đúng vị trí', () => {
  const cases = [
    ['road-not-axis', (d) => d.roads.push({ id: 'r', from: [0, 0], to: [1, 1] })],
    ['road-gap', (d) => d.roads.push({ id: 'r', from: [20, 20], to: [20, 22] })],
    [
      'junction-arm-road',
      (d) => d.junctions.push({ at: [0, 0], arms: [{ id: 'north', road: 'missing' }] }),
    ],
    [
      'signal-order-arm',
      (d) => d.junctions.push({ at: [0, 0], arms: [], signal: { order: ['west'] } }),
    ],
    [
      'lot-on-road',
      (d) => {
        d.roads.push({ id: 'r', from: [10, 10], to: [10, 11] });
        d.lots.push({ id: 'l', at: [10, 10], size: [1, 1], kind: 'empty', components: [] });
      },
    ],
    [
      'lot-overlap',
      (d) =>
        d.lots.push(
          { id: 'a', at: [10, 10], size: [1, 1], kind: 'empty', components: [] },
          { id: 'b', at: [10, 10], size: [1, 1], kind: 'empty', components: [] },
        ),
    ],
    [
      'shop-lot-no-sidewalk',
      (d) =>
        d.lots.push({
          id: 'a',
          at: [10, 10],
          size: [1, 1],
          kind: 'shop',
          facing: 'west',
          components: [],
        }),
    ],
    [
      'unregistered',
      (d) =>
        d.lots.push({
          id: 'a',
          at: [10, 10],
          size: [1, 1],
          kind: 'empty',
          components: [{ kit: 'absent', slot: 'absent', variant: 'a' }],
        }),
    ],
  ];
  for (const [code, mutate] of cases) {
    const invalid = structuredClone(map);
    mutate(invalid.districts[0]);
    assert.ok(
      cityMapIssues(invalid, { blocks, config }).some(
        (issue) => issue.code === code && issue.path.startsWith('districts[0].'),
      ),
      code,
    );
  }
});

test('báo món đang chờ đã được đăng ký', () => {
  const invalid = { ...map, pending: [{ kit: 'alley-parts', slot: 'tree', issue: 224 }] };
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some(
      (issue) => issue.code === 'pending-resolved' && issue.path === 'pending[0]',
    ),
  );
});

test('dịch đúng vị trí từng món của khối về toạ độ thế giới', () => {
  const actual = cityPlan(map, { blocks }).placements;
  const expected = streetPlan(block);
  for (let i = 0; i < expected.length; i += 1) {
    assert.deepEqual(actual[i].position, [
      expected[i].position[0] + 6,
      expected[i].position[1],
      expected[i].position[2] + 4,
    ]);
    assert.equal(actual[i].yaw, expected[i].yaw);
  }
});

test('chỉ lấy vạch của nhánh xe đang đi vào nút giao', () => {
  const junction = {
    at: [3, 0],
    arms: [
      { id: 'west', stopLine: 4 },
      { id: 'east', stopLine: 4 },
      { id: 'north', stopLine: 4 },
    ],
  };
  const city = { grid: 4, districts: [{ origin: [0, 0], junctions: [junction] }] };
  const plan = { arms: ['west', 'east', 'north'] };
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 0],
          [20, 0],
        ],
      },
      plan,
    ),
    [{ distance: 8, arm: 'west', plan }],
  );
});

test('tiệm không được coi là chạm vỉa hè chỉ vì gần đường', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].roads.push({ id: 'r', from: [10, 10], to: [10, 12] });
  invalid.districts[0].lots.push({
    id: 'shop',
    at: [11, 10],
    size: [1, 1],
    kind: 'shop',
    facing: 'west',
    components: [],
  });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some(
      (issue) => issue.code === 'shop-lot-no-sidewalk',
    ),
  );
});

test('giới hạn bao quanh khối sau khi xoay', () => {
  const rotated = structuredClone(map);
  rotated.districts[0].blocks[0].rotation = 90;
  assert.deepEqual(mapBounds(rotated, { blocks }), { minX: 0, maxX: 12, minZ: -4, maxZ: 12 });
});

test('tiệm chạm đúng mép vỉa hè được chấp nhận', () => {
  const valid = structuredClone(map);
  valid.districts[0].lots.push({
    id: 'shop',
    at: [0, 1],
    size: [1, 1],
    kind: 'shop',
    facing: 'south',
    components: [],
  });
  assert.equal(
    cityMapIssues(valid, { blocks, config }).some((issue) => issue.code === 'shop-lot-no-sidewalk'),
    false,
  );
});

test('vạch nằm trên đoạn trước tâm nút vẫn được tính', () => {
  const junction = { at: [3, 0], arms: [{ id: 'west', stopLine: 4 }] };
  const city = { grid: 4, districts: [{ origin: [0, 0], junctions: [junction] }] };
  const plan = { arms: ['west'] };
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 0],
          [8, 0],
          [16, 0],
        ],
      },
      plan,
    ),
    [{ distance: 8, arm: 'west', plan }],
  );
});

test('xe dừng gần vạch đỏ theo khoảng cách được tính từ bản đồ', () => {
  const laneBlock = {
    cells: [6, 1],
    roads: Array.from({ length: 6 }, (_, x) => ({ cell: [x, 0], kind: 'straight' })),
  };
  const plan = createJunctionPlan({
    arms: ['east', 'west'],
    order: ['east', 'west'],
    green: 20,
    yellow: 2,
    allRed: 3,
    offset: 0,
  });
  const city = {
    grid: 4,
    districts: [
      { origin: [0, 0], junctions: [{ at: [2, 0], arms: [{ id: 'west', stopLine: 4 }] }] },
    ],
  };
  const lines = stopLinesFor(
    city,
    {
      points: [
        [-10, 0],
        [10, 0],
      ],
    },
    plan,
  );
  const lane = createTrafficLane(laneBlock, { duration: 20, stopOffset: 0.2, stopLines: lines });
  const state = lane.positionAt(15);
  assert.ok(state.distance >= lines[0].distance - 0.5 && state.distance < lines[0].distance);
});

test('vạch ở đoạn trước vẫn được tính khi khoảng cách đến tâm vượt chiều dài đoạn cuối', () => {
  const city = {
    grid: 4,
    districts: [
      { origin: [0, 0], junctions: [{ at: [3, 0], arms: [{ id: 'west', stopLine: 6 }] }] },
    ],
  };
  const plan = { arms: ['west'] };
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 0],
          [8, 0],
          [16, 0],
        ],
      },
      plan,
    ),
    [{ distance: 6, arm: 'west', plan }],
  );
});

test('nhánh phải chỉ về hướng của đường tiếp giáp', () => {
  const invalid = structuredClone(map);
  const d = invalid.districts[0];
  d.roads.push({ id: 'r', from: [10, 10], to: [12, 10] });
  d.junctions.push({ id: 'j', at: [10, 10], arms: [{ id: 'west', road: 'r' }] });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some((issue) => issue.code === 'junction-arm-road'),
  );
});

test('phát hiện lô đè lên đường của khối phố', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].lots.push({
    id: 'lot',
    at: [0, 2],
    size: [1, 1],
    kind: 'empty',
    facing: 'north',
    components: [],
  });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some((issue) => issue.code === 'lot-on-road'),
  );
});

test('đầu đường chỉ nối khối khi chạm ô đường tại mép khối', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].roads.push({ id: 'r', from: [0, 0], to: [0, -2] });
  assert.ok(cityMapIssues(invalid, { blocks, config }).some((issue) => issue.code === 'road-gap'));
});

test('phát hiện lô mới chồng lên lô trong khối phố', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].lots.push({
    id: 'new',
    at: [0, 0],
    size: [1, 1],
    kind: 'empty',
    facing: 'north',
    components: [],
  });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some((issue) => issue.code === 'lot-overlap'),
  );
});

test('khu mẫu hợp lệ theo hợp đồng và không có lỗi bản đồ', async () => {
  const { Ajv2020 } = await import('ajv/dist/2020.js');
  const sample = JSON.parse(readFileSync(new URL('../city-maps/khu-mau.json', import.meta.url)));
  const schema = JSON.parse(
    readFileSync(new URL('../../contracts/world/v1/city-map.schema.json', import.meta.url)),
  );
  const validate = new Ajv2020({ strict: false }).compile(schema);
  assert.equal(validate(sample), true, JSON.stringify(validate.errors));
  assert.deepEqual(cityMapIssues(sample, { blocks, config }), []);
});

test('các vị trí đang chờ chỉ tham chiếu issue 251', () => {
  const sample = JSON.parse(readFileSync(new URL('../city-maps/khu-mau.json', import.meta.url)));
  const pending = cityPlan(sample, { blocks }).pendingPlacements;
  assert.ok(pending.length > 0);
  assert.deepEqual([...new Set(pending.map((item) => item.issue))], [251]);
});

test('tính vạch trong làn khi tâm nút nằm ngoài cuối làn', () => {
  const city = {
    grid: 4,
    districts: [
      { origin: [0, 0], junctions: [{ at: [4, 0], arms: [{ id: 'west', stopLine: 6 }] }] },
    ],
  };
  const plan = { arms: ['west'] };
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 0],
          [12, 0],
        ],
      },
      plan,
    ),
    [{ distance: 10, arm: 'west', plan }],
  );
});

test('phát hiện lô hai khu chồng nhau trong tọa độ thế giới', () => {
  const d = {
    id: 'a',
    name: 'A',
    origin: [0, 0],
    blocks: [],
    roads: [],
    junctions: [],
    lots: [{ id: 'one', at: [2, 2], size: [1, 1], kind: 'empty', facing: 'north', components: [] }],
  };
  const city = {
    grid: 4,
    districts: [
      d,
      {
        ...structuredClone(d),
        id: 'b',
        origin: [1, 0],
        lots: [{ ...d.lots[0], id: 'two', at: [1, 2] }],
      },
    ],
  };
  assert.ok(cityMapIssues(city, { blocks, config }).some((issue) => issue.code === 'lot-overlap'));
});

test('lắp đường hẻm và ngã ba được khai trong bản đồ', () => {
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        blocks: [],
        roads: [{ id: 'r', tier: 'alley', from: [0, 0], to: [2, 0] }],
        junctions: [
          {
            id: 'j',
            at: [2, 0],
            kind: 'tee',
            arms: [{ id: 'west' }, { id: 'north' }, { id: 'south' }],
          },
        ],
        lots: [],
      },
    ],
  };
  const result = cityPlan(city, { blocks }).placements;
  assert.ok(result.some((p) => p.part === 'road_a' && p.position[0] === 4));
  assert.ok(result.some((p) => p.part === 'road_c' && p.position[0] === 8));
});

test('thứ tự pha thiếu một nhánh phải bị báo lỗi', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].junctions.push({
    id: 'j',
    at: [0, 0],
    arms: [
      { id: 'west', road: 'x' },
      { id: 'north', road: 'x' },
    ],
    signal: { order: ['west'] },
  });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some((issue) => issue.code === 'signal-order-arm'),
  );
});

test('báo thành phần chưa đăng ký được khai trong khối', () => {
  const bad = structuredClone(block);
  bad.variants.sidewalk = 'notregistered';
  assert.ok(
    cityMapIssues(map, { blocks: { 'hem-mau': bad }, config }).some(
      (issue) => issue.code === 'unregistered',
    ),
  );
});

test('phát hiện lô chồng một phần lên khối xoay', () => {
  const invalid = structuredClone(map);
  invalid.districts[0].blocks[0].rotation = 90;
  invalid.districts[0].lots.push({
    id: 'l',
    at: [1, 2],
    size: [1, 1],
    kind: 'empty',
    facing: 'north',
    components: [],
  });
  assert.ok(
    cityMapIssues(invalid, { blocks, config }).some(
      (issue) => issue.code === 'lot-overlap' || issue.code === 'lot-on-road',
    ),
  );
});

test('giới hạn lô tính tới mép ngoài ô đầu và ô cuối', () => {
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        blocks: [],
        roads: [],
        junctions: [],
        lots: [{ at: [0, 0], size: [1, 1] }],
      },
    ],
  };
  assert.deepEqual(mapBounds(city, { blocks }), { minX: -2, maxX: 2, minZ: -2, maxZ: 2 });
});

test('vạch tại hai nút không dùng nhầm pha đèn của nút khác', () => {
  const make = (at, green) => ({
    at,
    arms: [{ id: 'west', crossing: false, stopLine: 1 }],
    signal: { order: ['west'], green, yellow: 2, allRed: 3, offset: 0 },
  });
  const first = make([2, 0], 8),
    second = make([4, 0], 12);
  const city = { grid: 4, districts: [{ origin: [0, 0], junctions: [first, second] }] };
  const plan = createJunctionPlan(junctionPlanFor(first));
  const lines = stopLinesFor(
    city,
    {
      points: [
        [0, 0],
        [20, 0],
      ],
    },
    plan,
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[0].plan, plan);
  assert.equal(lines[1].distance, 15);
  assert.equal(lines[1].plan.green, 12);
});

test('báo lỗi lô trong khối khi đè lên đường', () => {
  const bad = structuredClone(block);
  bad.lots[0].cell = [0, 2];
  assert.ok(
    cityMapIssues(map, { blocks: { 'hem-mau': bad }, config }).some(
      (item) => item.code === 'lot-on-road',
    ),
  );
});

test('không gắn vạch dừng vào nút giao không có đèn', () => {
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        junctions: [{ at: [2, 0], signal: null, arms: [{ id: 'west', stopLine: 1 }] }],
      },
    ],
  };
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 0],
          [12, 0],
        ],
      },
      { arms: ['west'] },
    ),
    [],
  );
});

test('đường nhiều làn dựng đủ ô và đối xứng qua trục', () => {
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        blocks: [],
        roads: [
          { id: 'r', tier: 'avenue', from: [0, 0], to: [2, 0], lanes: { forward: 2, backward: 1 } },
        ],
        junctions: [],
        lots: [],
      },
    ],
  };
  const placements = cityPlan(city, { blocks }).placements;
  assert.equal(placements.length, 9);
  assert.deepEqual(
    [...new Set(placements.map((item) => item.position[2]))].sort((a, b) => a - b),
    [-4, 0, 4],
  );
});

test('giới hạn đường gồm cả bề rộng mặt hẻm', () => {
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        blocks: [],
        roads: [{ tier: 'alley', from: [0, 0], to: [2, 0], lanes: { forward: 1, backward: 1 } }],
        junctions: [],
        lots: [],
      },
    ],
  };
  assert.deepEqual(mapBounds(city, { blocks }), { minX: -2, maxX: 10, minZ: -2, maxZ: 2 });
});

test('phát hiện đường khu khác lấn lô trong khối', () => {
  const first = structuredClone(map.districts[0]);
  const second = {
    id: 'other',
    name: 'Other',
    origin: [0, 0],
    blocks: [],
    roads: [{ id: 'r', from: [0, 0], to: [0, 1] }],
    junctions: [],
    lots: [],
  };
  assert.ok(
    cityMapIssues({ grid: 4, districts: [first, second] }, { blocks, config }).some(
      (item) => item.code === 'lot-on-road',
    ),
  );
});

test('mỗi nút giữ vạch người đi bộ của chính nó dù chu kỳ giống nhau', () => {
  const signal = { order: ['west'], green: 8, yellow: 2, allRed: 3, offset: 0 };
  const first = { at: [2, 0], arms: [{ id: 'west', crossing: true, stopLine: 1 }], signal };
  const second = { at: [4, 0], arms: [{ id: 'west', crossing: false, stopLine: 1 }], signal };
  const city = { grid: 4, districts: [{ origin: [0, 0], junctions: [first, second] }] };
  const plan = createJunctionPlan(junctionPlanFor(first));
  const lines = stopLinesFor(
    city,
    {
      points: [
        [0, 0],
        [20, 0],
      ],
    },
    plan,
  );
  assert.equal(lines[0].plan.crossings.length, 1);
  assert.equal(lines[1].plan.crossings.length, 0);
});

test('lô chồng lên phần rìa đường nhiều làn bị báo lỗi', () => {
  const d = {
    id: 'd',
    origin: [0, 0],
    blocks: [],
    roads: [
      { id: 'r', tier: 'avenue', from: [0, 0], to: [4, 0], lanes: { forward: 2, backward: 2 } },
    ],
    junctions: [],
    lots: [{ id: 'l', at: [2, 1], size: [1, 1], kind: 'empty', facing: 'north', components: [] }],
  };
  assert.ok(
    cityMapIssues({ grid: 4, districts: [d] }, { blocks, config }).some(
      (i) => i.code === 'lot-on-road',
    ),
  );
});

test('hai khối đặt chồng được báo lỗi', () => {
  const city = structuredClone(map);
  city.districts[0].blocks.push(structuredClone(city.districts[0].blocks[0]));
  assert.ok(cityMapIssues(city, { blocks, config }).some((i) => i.code === 'lot-overlap'));
});

test('làn lệch tâm vẫn nhận vạch dừng cùng nhánh', () => {
  const junction = {
    at: [2, 0],
    signal: { order: ['west'], green: 8, yellow: 2, allRed: 3, offset: 0 },
    arms: [{ id: 'west', road: 'r', crossing: false, stopLine: 1 }],
  };
  const city = {
    grid: 4,
    districts: [
      {
        origin: [0, 0],
        roads: [
          { id: 'r', tier: 'avenue', from: [0, 0], to: [2, 0], lanes: { forward: 1, backward: 1 } },
        ],
        junctions: [junction],
      },
    ],
  };
  const plan = createJunctionPlan(junctionPlanFor(junction));
  assert.deepEqual(
    stopLinesFor(
      city,
      {
        points: [
          [0, 2],
          [12, 2],
        ],
      },
      plan,
    ),
    [{ distance: 7, arm: 'west', plan }],
  );
});

test('phát hiện đường cùng khu lấn lô trong khối', () => {
  const city = structuredClone(map);
  city.districts[0].roads.push({
    id: 'r',
    tier: 'alley',
    from: [0, 0],
    to: [0, 1],
    lanes: { forward: 1, backward: 1 },
  });
  assert.ok(cityMapIssues(city, { blocks, config }).some((i) => i.code === 'lot-on-road'));
});

test('hai đoạn đường ở hai khu nối nhau tại một điểm', () => {
  const d = {
    id: 'a',
    origin: [0, 0],
    blocks: [],
    roads: [
      { id: 'r', tier: 'alley', from: [0, 0], to: [1, 0], lanes: { forward: 1, backward: 1 } },
    ],
    junctions: [],
    lots: [],
  };
  const e = { ...structuredClone(d), id: 'b', origin: [1, 0] };
  const issues = cityMapIssues({ grid: 4, districts: [d, e] }, { blocks, config });
  assert.equal(issues.filter((item) => item.code === 'road-gap').length, 2);
});
