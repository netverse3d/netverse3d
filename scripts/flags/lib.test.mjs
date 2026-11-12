import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkUsages, envNameOf, findFlagUsages, validateFlags } from './lib.mjs';

const flag = {
  name: 'machine-license',
  component: 'payment',
  owner: 'baodhg',
  remove_by: '2027-01-31',
  summary: 'Chủ tiệm mua license máy',
};
const componentIds = ['payment', 'web-3d'];
const today = '2026-11-12';

test('cờ khai đủ thì không báo gì', () => {
  assert.deepEqual(validateFlags([flag], componentIds, today), []);
});

test('báo cờ thiếu từng trường bắt buộc', () => {
  const errors = validateFlags([{ name: 'half' }], componentIds, today).join();
  for (const field of ['component', 'owner', 'remove_by', 'summary']) {
    assert.ok(errors.includes(`half: missing ${field}`), field);
  }
});

test('báo tên cờ sai dạng và cờ khai trùng', () => {
  const errors = validateFlags(
    [{ ...flag, name: 'Machine_License' }, flag, flag],
    componentIds,
    today,
  ).join();
  assert.ok(errors.includes('Machine_License: name must be lowercase words joined by hyphens'));
  assert.ok(errors.includes('machine-license: duplicate flag'));
});

test('báo cờ gắn với thành phần không có trong catalog', () => {
  const errors = validateFlags([{ ...flag, component: 'ghost' }], componentIds, today).join();
  assert.ok(errors.includes('machine-license: component "ghost" is not in docs/catalog.yaml'));
});

test('báo cờ quá hạn gỡ và ngày sai dạng', () => {
  const expired = validateFlags([{ ...flag, remove_by: '2026-11-11' }], componentIds, today);
  assert.ok(expired.join().includes('machine-license: passed its removal date 2026-11-11'));
  const invalid = validateFlags([{ ...flag, remove_by: '31/01/2027' }], componentIds, today);
  assert.ok(invalid.join().includes('machine-license: remove_by must look like 2027-01-31'));
});

test('cờ hết hạn đúng hôm nay vẫn còn hiệu lực', () => {
  assert.deepEqual(validateFlags([{ ...flag, remove_by: today }], componentIds, today), []);
});

test('tên biến môi trường của cờ viết hoa, nối bằng gạch dưới', () => {
  assert.equal(envNameOf('machine-license'), 'FLAG_MACHINE_LICENSE');
});

test('tìm cờ dùng trong mã, kể cả dạng dành cho trình duyệt', () => {
  const usages = findFlagUsages([
    { path: 'services/payment/src/a.ts', text: "if (env.FLAG_MACHINE_LICENSE === 'true') {}" },
    { path: 'apps/web-3d/src/b.tsx', text: 'process.env.NEXT_PUBLIC_FLAG_CITY_MAP' },
    { path: 'apps/web-3d/test/c.ts', text: 'const CHROME_FLAGS = []; const FLAGS = 1;' },
  ]);
  assert.deepEqual(usages, [
    { name: 'machine-license', path: 'services/payment/src/a.ts' },
    { name: 'city-map', path: 'apps/web-3d/src/b.tsx' },
  ]);
});

test('báo mã dùng cờ chưa khai trong sổ', () => {
  const errors = checkUsages([{ name: 'city-map', path: 'apps/web-3d/src/b.tsx' }], [flag]).join();
  assert.ok(errors.includes('apps/web-3d/src/b.tsx: flag "city-map" is not declared'));
});

test('báo cờ còn trong sổ mà mã không còn dùng', () => {
  const errors = checkUsages([], [flag]).join();
  assert.ok(errors.includes('machine-license: declared but no code reads FLAG_MACHINE_LICENSE'));
});

test('cờ đã khai và có mã dùng thì không báo gì', () => {
  const usages = [{ name: 'machine-license', path: 'services/payment/src/a.ts' }];
  assert.deepEqual(checkUsages(usages, [flag]), []);
});
