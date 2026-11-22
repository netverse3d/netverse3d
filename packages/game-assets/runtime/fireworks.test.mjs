import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FIREWORK_COLORS,
  HOLIDAY_SCHEDULE,
  createFireworksSystem,
  getHolidayEvent,
  isHolidayFireworks,
} from './fireworks.mjs';

test('lịch sự kiện nhận diện chính xác các ngày lễ lớn trong năm', () => {
  assert.ok(Array.isArray(HOLIDAY_SCHEDULE.solar));
  assert.ok(HOLIDAY_SCHEDULE.lunar[2026]);
  assert.ok(isHolidayFireworks('2026-12-31'));
  const newYearEve = getHolidayEvent('2026-12-31');
  assert.equal(newYearEve.id, 'new-years-eve');

  assert.ok(isHolidayFireworks('2026-01-01'));
  const newYear = getHolidayEvent('2026-01-01');
  assert.equal(newYear.id, 'new-year');

  assert.ok(isHolidayFireworks('2026-04-30'));
  const reunification = getHolidayEvent('2026-04-30');
  assert.equal(reunification.id, 'reunification-day');

  assert.ok(isHolidayFireworks('2026-05-01'));
  assert.ok(isHolidayFireworks('2026-09-01'));
  assert.ok(isHolidayFireworks('2026-09-02'));
  const nationalDay = getHolidayEvent('2026-09-02');
  assert.equal(nationalDay.id, 'national-day');
});

test('nhận diện chính xác đêm giao thừa và dịp Tết Nguyên Đán theo năm', () => {
  const eve2026 = getHolidayEvent('2026-02-16');
  assert.ok(eve2026);
  assert.equal(eve2026.id, 'tet-giao-thua');
  assert.equal(eve2026.category, 'lunar');

  const m1Tet2026 = getHolidayEvent('2026-02-17');
  assert.ok(m1Tet2026);
  assert.equal(m1Tet2026.category, 'lunar');

  const eve2027 = getHolidayEvent('2027-02-05');
  assert.ok(eve2027);
  assert.equal(eve2027.id, 'tet-giao-thua');

  const eve2025 = getHolidayEvent('2025-01-28');
  assert.ok(eve2025);
  assert.equal(eve2025.id, 'tet-giao-thua');
});

test('các ngày bình thường không có pháo hoa', () => {
  assert.equal(isHolidayFireworks('2026-03-15'), false);
  assert.equal(getHolidayEvent('2026-03-15'), null);
  assert.equal(isHolidayFireworks('2026-07-20'), false);
  assert.equal(isHolidayFireworks('2026-11-20'), false);
  assert.equal(isHolidayFireworks('invalid-date'), false);
});

test('bảng màu pháo hoa có các màu cơ bản rực rỡ', () => {
  assert.ok(FIREWORK_COLORS.length >= 5);
  for (const color of FIREWORK_COLORS) {
    assert.equal(color.length, 3);
    for (const channel of color) {
      assert.ok(channel >= 0 && channel <= 1.0);
    }
  }
});

test('hệ thống hạt pháo hoa khởi tạo với buffer và Points của Three.js', () => {
  const fireworks = createFireworksSystem(THREE, { maxParticles: 1000, enabled: false });
  assert.ok(fireworks.mesh);
  assert.ok(fireworks.mesh.isPoints);
  assert.equal(fireworks.activeParticles, 0);
  assert.equal(fireworks.isEnabled, false);
  fireworks.dispose();
});

test('vụ nổ pháo hoa sinh số hạt, phân bố vận tốc toả đều và tắt dần theo thời gian', () => {
  const fireworks = createFireworksSystem(THREE, { maxParticles: 500, enabled: false });

  fireworks.launchBurst({
    origin: [0, 20, 0],
    count: 80,
    color: [1.0, 0.8, 0.2],
    speed: 8.0,
    lifespan: 1.0,
  });

  assert.equal(fireworks.activeParticles, 80);

  fireworks.update(0.1);
  assert.equal(fireworks.activeParticles, 80);
  const posArray = fireworks.mesh.geometry.attributes.position.array;
  assert.ok(posArray[1] > 18.0);

  fireworks.update(1.2);
  assert.equal(fireworks.activeParticles, 0);

  fireworks.dispose();
});

test('bật/tắt trạng thái tự động bắn của hệ thống pháo hoa', () => {
  const fireworks = createFireworksSystem(THREE, { maxParticles: 500, enabled: true });
  assert.equal(fireworks.isEnabled, true);

  fireworks.setEnabled(false);
  assert.equal(fireworks.isEnabled, false);

  fireworks.dispose();
});
