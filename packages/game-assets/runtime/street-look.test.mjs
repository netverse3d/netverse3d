import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  NIGHT_SKY,
  OUTDOOR_LIGHTING,
  SIDEWALK_TOP,
  STREET_CELL,
  blockIssues,
  facadePlacements,
  lotFrontage,
  missingParts,
  nightSkyGradientStops,
  propPlacements,
  renderNightSkyCanvas,
  roadLane,
  setupOutdoorEnvironment,
  applyWeatherToOutdoor,
  createFireworksSystem,
  getHolidayEvent,
  isHolidayFireworks,
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

test('vòm trời đêm và bộ ánh sáng ngoài trời có đủ thông số theo chuẩn ADR-0019', () => {
  const hex = /^#[0-9a-fA-F]{6}$/;
  for (const [key, color] of Object.entries(NIGHT_SKY)) {
    assert.match(color, hex, `NIGHT_SKY.${key} phải là mã màu hex 6 chữ số`);
  }
  assert.equal(typeof OUTDOOR_LIGHTING.exposure, 'number');
  assert.equal(typeof OUTDOOR_LIGHTING.environmentIntensity, 'number');
  assert.equal(OUTDOOR_LIGHTING.fog.color, NIGHT_SKY.horizon);
  assert.ok(OUTDOOR_LIGHTING.fog.near >= 15);
  assert.ok(OUTDOOR_LIGHTING.fog.far <= 120);
  assert.ok(OUTDOOR_LIGHTING.fog.far > OUTDOOR_LIGHTING.fog.near);
});

test('dải chuyển sắc vòm trời đêm có đủ các mốc từ đỉnh trời xuống quầng sáng chân trời và nền đất', () => {
  const stops = nightSkyGradientStops(NIGHT_SKY);
  assert.ok(stops.length >= 5);
  assert.equal(stops[0].offset, 0);
  assert.equal(stops[0].color, NIGHT_SKY.zenith);
  assert.equal(stops.at(-1).offset, 1);
  assert.equal(stops.at(-1).color, NIGHT_SKY.nadir);
  const horizonStop = stops.find((s) => s.offset === 0.5);
  assert.ok(horizonStop);
  assert.equal(horizonStop.color, NIGHT_SKY.horizon);
});

test('cấu hình assets.config.json đăng ký thành phần vòm trời ngoài trời theo ADR-0019', () => {
  assert.ok(CONFIG.environments?.['night-sky']);
  const env = CONFIG.environments['night-sky'];
  assert.equal(env.id, 'night-sky');
  assert.equal(env.colors.zenith, NIGHT_SKY.zenith);
  assert.equal(env.colors.horizon, NIGHT_SKY.horizon);
  assert.equal(env.fog.color, OUTDOOR_LIGHTING.fog.color);
});

test('renderNightSkyCanvas vẽ dải gradient tuyến tính lên canvas', () => {
  const added = [];
  const mockCanvas = {
    width: 512,
    height: 256,
    getContext: () => ({
      createLinearGradient: () => ({
        addColorStop: (offset, color) => added.push({ offset, color }),
      }),
      fillRect: () => {},
      fillStyle: null,
    }),
  };
  const canvas = renderNightSkyCanvas(mockCanvas, NIGHT_SKY);
  assert.equal(canvas, mockCanvas);
  assert.equal(added.length, nightSkyGradientStops(NIGHT_SKY).length);
});

test('setupOutdoorEnvironment gán nền, sương và môi trường phản chiếu khớp nhau', () => {
  const scene = { add: () => {} };
  const renderer = { toneMappingExposure: 0 };
  const mockTexture = { isTexture: true };
  const pmrem = {
    fromEquirectangular: () => ({ texture: { isEnv: true } }),
  };
  const result = setupOutdoorEnvironment(
    {
      Fog: function (color, near, far) {
        this.color = color;
        this.near = near;
        this.far = far;
      },
      HemisphereLight: function (sky, ground, intensity) {
        this.sky = sky;
        this.ground = ground;
        this.intensity = intensity;
      },
      DirectionalLight: function (color, intensity) {
        this.color = color;
        this.intensity = intensity;
        this.position = { set: () => {} };
      },
    },
    scene,
    renderer,
    {
      skyTexture: mockTexture,
      pmrem,
    },
  );
  assert.equal(scene.background, mockTexture);
  assert.ok(scene.environment);
  assert.equal(scene.fog.color, NIGHT_SKY.horizon);
  assert.equal(scene.fog.near, OUTDOOR_LIGHTING.fog.near);
  assert.equal(scene.fog.far, OUTDOOR_LIGHTING.fog.far);
  assert.equal(renderer.toneMappingExposure, OUTDOOR_LIGHTING.exposure);
  assert.ok(result.hemisphere);
  assert.ok(result.moon);
  result.update({ environment: { source: 'none', intensity: 0 } });
  assert.equal(result.preset.environment.source, 'none');
  assert.equal(result.envTexture, null);
  assert.equal(scene.environment, null);
});

test('applyWeatherToOutdoor gửi bộ thay đổi qua handle và cập nhật độ nhám mặt đường', () => {
  let change;
  const handle = { update: (next) => (change = next) };
  const materials = {
    surface: { roughness: 0.85 },
  };

  const weather = {
    fog: { color: '#1a122c', near: 8, far: 55, density: 0.035 },
    environmentIntensity: 0.35,
    exposure: 0.88,
    wetness: 1.0,
  };

  applyWeatherToOutdoor(handle, weather, { materials });

  assert.deepEqual(change, {
    fog: weather.fog,
    environment: { intensity: weather.environmentIntensity },
    exposure: weather.exposure,
  });
  assert.equal(materials.surface.roughness, 0.15);
});

test('street-look tái xuất các hàm pháo hoa và lịch sự kiện lễ Tết', () => {
  assert.equal(typeof createFireworksSystem, 'function');
  assert.equal(typeof getHolidayEvent, 'function');
  assert.equal(typeof isHolidayFireworks, 'function');
  assert.ok(isHolidayFireworks('2026-02-16'));
});
