import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  TRANSITION_PROBABILITIES,
  WEATHER_CONFIG,
  WEATHER_STATES,
  applyQualityLevel,
  calculateRoadRoughness,
  getWeatherAtTime,
  getWeatherSequence,
  hashSeed,
  interpolateWeather,
} from './weather.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('định nghĩa đủ 4 trạng thái thời tiết theo REQ-043', () => {
  const keys = Object.keys(WEATHER_STATES);
  assert.deepEqual(keys, ['clear', 'lightRain', 'heavyRain', 'denseFog']);

  const clear = WEATHER_STATES.clear;
  assert.equal(clear.id, 'clear');
  assert.equal(clear.rainCount, 0);
  assert.equal(clear.wetness, 0);

  const lightRain = WEATHER_STATES.lightRain;
  assert.equal(lightRain.id, 'lightRain');
  assert.ok(lightRain.rainCount > 0);
  assert.ok(lightRain.wetness > 0);

  const heavyRain = WEATHER_STATES.heavyRain;
  assert.equal(heavyRain.id, 'heavyRain');
  assert.ok(heavyRain.rainCount > lightRain.rainCount);
  assert.equal(heavyRain.wetness, 1.0);

  const denseFog = WEATHER_STATES.denseFog;
  assert.equal(denseFog.id, 'denseFog');
  assert.equal(denseFog.rainCount, 0);
  assert.ok(denseFog.fog.density > clear.fog.density);
});

test('xác suất chuyển trạng thái hợp lệ và tổng mỗi trạng thái bằng 1.0', () => {
  for (const [stateId, transitions] of Object.entries(TRANSITION_PROBABILITIES)) {
    assert.ok(WEATHER_STATES[stateId]);
    const total = transitions.reduce((sum, item) => sum + item.weight, 0);
    assert.ok(Math.abs(total - 1.0) < 1e-6);
  }
});

test('bộ băm hạt giống tất định: cùng hạt giống và chỉ số sinh cùng số ngẫu nhiên', () => {
  const val1 = hashSeed('saigon-district-1', 42);
  const val2 = hashSeed('saigon-district-1', 42);
  const val3 = hashSeed('saigon-district-1', 43);
  const val4 = hashSeed('saigon-district-2', 42);

  assert.equal(val1, val2);
  assert.notEqual(val1, val3);
  assert.notEqual(val1, val4);
  assert.ok(val1 >= 0 && val1 < 1);
});

test('chuỗi thời tiết tất định giữa các máy cùng hạt giống', () => {
  const seqA = getWeatherSequence('district-block-seed', 8);
  const seqB = getWeatherSequence('district-block-seed', 8);
  assert.deepEqual(seqA, seqB);
  assert.equal(seqA.length, 8);
  for (const id of seqA) {
    assert.ok(WEATHER_STATES[id]);
  }
});

test('nội suy thông số giữa hai trạng thái mượt mà', () => {
  const from = WEATHER_STATES.clear;
  const to = WEATHER_STATES.heavyRain;

  const at0 = interpolateWeather(from, to, 0.0);
  assert.equal(at0.rainCount, from.rainCount);
  assert.equal(at0.wetness, from.wetness);

  const at50 = interpolateWeather(from, to, 0.5);
  assert.equal(at50.rainCount, Math.round((from.rainCount + to.rainCount) / 2));
  assert.ok(at50.wetness > from.wetness && at50.wetness < to.wetness);

  const at100 = interpolateWeather(from, to, 1.0);
  assert.equal(at100.rainCount, to.rainCount);
  assert.equal(at100.wetness, to.wetness);
});

test('mặt đường khô dần chậm hơn lúc tạnh mưa', () => {
  const from = WEATHER_STATES.heavyRain;
  const to = WEATHER_STATES.clear;

  const weather = getWeatherAtTime({
    seed: 'saigon-test',
    fromState: from,
    toState: to,
    timeIntoCycle: 30,
    cycleDuration: 180,
    transitionDuration: 30,
    dryingDuration: 90,
  });

  assert.equal(weather.rainCount, 0);
  assert.ok(weather.wetness > 0.4);
});

test('tính toán độ nhám mặt đường ướt phản chiếu vệt đèn theo tiêu chí M1', () => {
  const dryRoughness = calculateRoadRoughness(0.85, 0.0);
  const halfWetRoughness = calculateRoadRoughness(0.85, 0.5);
  const soakedRoughness = calculateRoadRoughness(0.85, 1.0);

  assert.equal(dryRoughness, 0.85);
  assert.ok(halfWetRoughness < dryRoughness);
  assert.ok(soakedRoughness < halfWetRoughness);
  assert.equal(soakedRoughness, 0.15);
});

test('chất lượng thấp tắt hạt mưa nhưng không đổi trạng thái thời tiết', () => {
  const state = WEATHER_STATES.heavyRain;

  const lowQuality = applyQualityLevel(state, 'low');
  assert.equal(lowQuality.rainCount, 0);
  assert.equal(lowQuality.droplets, 0);
  assert.equal(lowQuality.wetness, state.wetness);
  assert.equal(lowQuality.fog.density, state.fog.density);

  const medQuality = applyQualityLevel(state, 'medium');
  assert.equal(medQuality.rainCount, Math.round(state.rainCount * 0.5));
  assert.equal(medQuality.wetness, state.wetness);

  const highQuality = applyQualityLevel(state, 'high');
  assert.equal(highQuality.rainCount, state.rainCount);
  assert.equal(highQuality.wetness, state.wetness);
});

test('cấu hình assets.config.json đăng ký cấu hình thời tiết theo ADR-0019', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'assets.config.json'), 'utf8'));
  assert.ok(config.weather);
  assert.ok(config.weather.states);
  assert.equal(Object.keys(config.weather.states).length, 4);
  assert.ok(config.weather.cycle);
  assert.equal(config.weather.cycle.transitionDuration, WEATHER_CONFIG.transitionDuration);
});
