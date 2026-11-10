import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  detectQuality,
  isQualityLevel,
  pixelRatioFor,
} from './quality.ts';

test('ba mức chất lượng, mỗi mức có đủ tham số', () => {
  assert.deepEqual(QUALITY_LEVELS, ['low', 'medium', 'high']);
  for (const level of QUALITY_LEVELS) {
    const preset = QUALITY_PRESETS[level];
    assert.ok(preset.maxPixelRatio > 0);
    assert.equal(typeof preset.bloom, 'boolean');
    assert.equal(typeof preset.shadows, 'boolean');
  }
  assert.equal(isQualityLevel('high'), true);
  assert.equal(isQualityLevel('ultra'), false);
});

test('máy yếu hoặc điện thoại nhận mức thấp', () => {
  assert.equal(detectQuality({ hardwareConcurrency: 4, devicePixelRatio: 3, mobile: true }), 'low');
  assert.equal(
    detectQuality({
      hardwareConcurrency: 2,
      devicePixelRatio: 1,
      mobile: false,
      renderer: 'Intel',
    }),
    'low',
  );
});

test('đồ hoạ tích hợp trên máy tính nhận mức vừa, card rời nhận mức cao', () => {
  assert.equal(
    detectQuality({
      hardwareConcurrency: 20,
      devicePixelRatio: 1,
      mobile: false,
      renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)',
    }),
    'medium',
  );
  assert.equal(
    detectQuality({
      hardwareConcurrency: 16,
      devicePixelRatio: 1,
      mobile: false,
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)',
    }),
    'high',
  );
  assert.equal(
    detectQuality({
      hardwareConcurrency: 12,
      devicePixelRatio: 2,
      mobile: false,
      renderer: 'Apple M2',
    }),
    'high',
  );
});

test('tỉ lệ điểm ảnh bị chặn theo mức và không vượt màn hình', () => {
  assert.equal(pixelRatioFor('low', 3), 1);
  assert.equal(pixelRatioFor('medium', 3), 1.5);
  assert.equal(pixelRatioFor('high', 3), 2);
  assert.equal(pixelRatioFor('high', 1.25), 1.25);
});
