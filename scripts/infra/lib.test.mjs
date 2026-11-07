import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findMissingTools,
  findUnhealthyServices,
  httpProbes,
  parseComposeStatus,
  parseEnvFile,
} from './lib.mjs';

test('báo dịch vụ chưa được tạo', () => {
  assert.deepEqual(findUnhealthyServices([], ['redis']), ['redis: not created']);
});

test('báo dịch vụ đã dừng', () => {
  const statuses = [{ Service: 'redis', State: 'exited', Health: '' }];
  assert.deepEqual(findUnhealthyServices(statuses, ['redis']), ['redis: exited']);
});

test('báo dịch vụ chạy nhưng healthcheck đang lỗi', () => {
  const statuses = [{ Service: 'kafka', State: 'running', Health: 'unhealthy' }];
  assert.deepEqual(findUnhealthyServices(statuses, ['kafka']), ['kafka: unhealthy']);
});

test('nhận dịch vụ chạy tốt, kể cả dịch vụ không khai healthcheck', () => {
  const statuses = [
    { Service: 'kafka', State: 'running', Health: 'healthy' },
    { Service: 'loki', State: 'running', Health: '' },
  ];
  assert.deepEqual(findUnhealthyServices(statuses, ['kafka', 'loki']), []);
});

test('đọc trạng thái compose theo từng dòng JSON', () => {
  const output = '{"Service":"a","State":"running"}\n{"Service":"b","State":"exited"}\n';
  assert.deepEqual(
    parseComposeStatus(output).map((item) => item.Service),
    ['a', 'b'],
  );
});

test('đầu dò HTTP dùng đúng cổng cấu hình', () => {
  const probes = new Map(httpProbes({ GRAFANA_PORT: '1234' }));
  assert.equal(probes.get('grafana'), 'http://127.0.0.1:1234/api/health');
  assert.equal(probes.get('loki'), 'http://127.0.0.1:53100/ready');
});

test('đọc tệp env và bỏ qua dòng không hợp lệ', () => {
  assert.deepEqual(parseEnvFile('A_B=1\nnot valid\nC=x y\r\n'), { A_B: '1', C: 'x y' });
});

test('liệt kê công cụ còn thiếu', () => {
  assert.deepEqual(
    findMissingTools((tool) => tool === 'node', ['node', 'docker']),
    ['docker'],
  );
});
