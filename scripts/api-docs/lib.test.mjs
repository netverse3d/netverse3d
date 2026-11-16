import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { projectServiceDocument } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const services = ['identity', 'media', 'notification'];

test('bản tài liệu công khai giữ đủ API qua cổng và dùng đúng URL máy chủ', () => {
  const routes = parse(readFileSync(join(root, 'infra/gateway/routes.yaml'), 'utf8')).routes;
  for (const service of services) {
    const source = parse(
      readFileSync(join(root, `packages/contracts/openapi/v1/${service}.yaml`), 'utf8'),
    );
    const publicDocument = JSON.parse(
      readFileSync(join(root, `infra/gateway/docs/${service}.json`), 'utf8'),
    );
    const route = routes.find((item) => item.id === service);
    assert.deepEqual(publicDocument.servers, [{ url: route.strip }]);
    assert.deepEqual(
      Object.keys(publicDocument.paths).sort(),
      Object.keys(source.paths)
        .filter((path) => path === '/v1' || path.startsWith('/v1/'))
        .sort(),
    );
    assert.deepEqual(publicDocument.components, source.components);
    assert.deepEqual(publicDocument.security, source.security);
    assert.equal(publicDocument.paths['/healthz'], undefined);
    assert.equal(publicDocument.paths['/livez'], undefined);
  }
});

test('một cấu hình giao diện liệt kê đúng ba service', () => {
  const config = JSON.parse(readFileSync(join(root, 'infra/gateway/docs/config.json'), 'utf8'));
  assert.deepEqual(config.urls, [
    { url: '/docs/identity.json', name: 'Identity Service' },
    { url: '/docs/media.json', name: 'Media Service' },
    { url: '/docs/notification.json', name: 'Notification Service' },
  ]);
  assert.equal(config.validatorUrl, 'none');
});

test('không sinh tài liệu nếu route công khai của service bị đổi', () => {
  const source = parse(
    readFileSync(join(root, 'packages/contracts/openapi/v1/identity.yaml'), 'utf8'),
  );
  const route = {
    entrypoint: 'web',
    prefix: '/api/identity/v1',
    strip: '/api/identity',
    backend: { service: 'identity' },
  };
  assert.ok(projectServiceDocument(source, route, 'identity').paths['/v1/auth/providers']);
  assert.throws(
    () => projectServiceDocument(source, { ...route, strip: '/api/other' }, 'identity'),
    /missing public gateway route/,
  );
});
