import assert from 'node:assert/strict';
import { win32 } from 'node:path';
import { test } from 'node:test';
import {
  IMAGES,
  checkFreeDisk,
  dockerDataPath,
  generatedIdentityKeys,
  secretManifest,
  checkToolVersions,
  clusterExists,
  parseK3dVersion,
  parseKubectlMinor,
} from './lib.mjs';

const versions = { k3d: '5.9.0', kubectl: '1.35' };

test('kiểm phiên bản công cụ từ chối k3d khác bản ghim', () => {
  const errors = checkToolVersions({ k3d: '5.8.3', kubectlMinor: '35' }, versions);
  assert.deepEqual(errors, ['k3d 5.8.3 found, 5.9.0 required']);
  assert.deepEqual(checkToolVersions({ k3d: '5.9.0', kubectlMinor: '35' }, versions), []);
  assert.deepEqual(checkToolVersions({ k3d: null, kubectlMinor: '35' }, versions), [
    'k3d not found, 5.9.0 required',
  ]);
});

test('kiểm phiên bản kubectl chỉ so minor', () => {
  assert.deepEqual(checkToolVersions({ k3d: '5.9.0', kubectlMinor: '34' }, versions), [
    'kubectl 1.34 found, 1.35 required',
  ]);
  assert.equal(
    parseKubectlMinor(
      JSON.stringify({ clientVersion: { major: '1', minor: '35', gitVersion: 'v1.35.10' } }),
    ),
    '35',
  );
  assert.equal(parseKubectlMinor('not json'), null);
});

test('đọc được phiên bản k3d từ đầu ra thật', () => {
  assert.equal(
    parseK3dVersion('k3d version v5.9.0\nk3s version v1.35.9-k3s1 (default)\n'),
    '5.9.0',
  );
  assert.equal(parseK3dVersion(''), null);
});

test('danh sách image gồm đủ năm thành phần chạy sau cổng', () => {
  assert.deepEqual(
    IMAGES.map((image) => image.id),
    ['identity', 'media', 'notification', 'payment', 'web-3d'],
  );
  assert.equal(IMAGES.find((image) => image.id === 'web-3d').dockerfile, 'apps/web-3d/Dockerfile');
  assert.equal(
    IMAGES.find((image) => image.id === 'payment').dockerfile,
    'services/payment/Dockerfile',
  );
});

test('nhận ra cụm đã tồn tại từ k3d cluster list -o json', () => {
  const listed = JSON.stringify([{ name: 'other' }, { name: 'netverse', serversRunning: 1 }]);
  assert.equal(clusterExists(listed, 'netverse'), true);
  assert.equal(clusterExists(JSON.stringify([{ name: 'other' }]), 'netverse'), false);
  assert.equal(clusterExists('', 'netverse'), false);
});

test('sinh khoá identity đúng định dạng service yêu cầu và khác nhau mỗi lần', () => {
  const first = generatedIdentityKeys();
  const second = generatedIdentityKeys();
  assert.match(first.KEY_ENCRYPTION_SECRET, /^[0-9a-f]{64}$/);
  assert.ok(first.OTP_HASH_SECRET.length >= 32);
  assert.notEqual(first.KEY_ENCRYPTION_SECRET, second.KEY_ENCRYPTION_SECRET);
  const manifest = secretManifest('identity-keys', 'netverse', first);
  assert.equal(manifest.kind, 'Secret');
  assert.equal(manifest.metadata.namespace, 'netverse');
  assert.deepEqual(manifest.stringData, first);
});

test('tìm thư mục dữ liệu Docker theo nền tảng', () => {
  assert.equal(
    dockerDataPath({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:/Users/dev/AppData/Local' },
      settings: { CustomWslDistroDir: 'E:/docker/DockerDesktopWSL' },
    }),
    'E:/docker/DockerDesktopWSL',
  );
  assert.equal(
    dockerDataPath({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:/Users/dev/AppData/Local' },
      settings: null,
    }),
    win32.join('C:/Users/dev/AppData/Local', 'Docker'),
  );
  assert.equal(dockerDataPath({ platform: 'linux', env: {}, settings: null }), '/var/lib/docker');
  assert.equal(
    dockerDataPath({
      platform: 'linux',
      env: { NETVERSE_DOCKER_DATA_DIR: '/data' },
      settings: null,
    }),
    '/data',
  );
});

test('dừng build khi ổ chứa Docker còn dưới ngưỡng', () => {
  const gib = 1024 ** 3;
  assert.deepEqual(checkFreeDisk({ path: 'E:/docker', freeBytes: 30 * gib, minFreeGb: 25 }), []);
  assert.deepEqual(checkFreeDisk({ path: 'E:/docker', freeBytes: 10.5 * gib, minFreeGb: 25 }), [
    'only 10.5 GB free where Docker stores data (E:/docker); at least 25 GB is required before building images',
  ]);
});
