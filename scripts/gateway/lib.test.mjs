import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAllDocuments, parse } from 'yaml';
import {
  GENERATED_HEADER,
  findUntrustedBackends,
  renderCompose,
  renderKubernetes,
  renderKubernetesMiddlewares,
  validateRoutes,
} from './lib.mjs';

function baseDoc(routes) {
  return {
    version: 1,
    entrypoints: { web: { port: 8000 }, storage: { port: 8333 } },
    policies: {
      'rate-api': { rateLimit: { average: 100, period: '1s', burst: 200 } },
      'rate-auth': { rateLimit: { average: 30, period: '1m', burst: 10 } },
      'body-1m': { maxRequestBodyBytes: 1048576 },
    },
    routes,
  };
}

const identity = {
  id: 'identity',
  entrypoint: 'web',
  prefix: '/api/identity/v1',
  strip: '/api/identity',
  backend: { service: 'identity', port: 3000 },
  policies: ['rate-api', 'body-1m'],
};
const identityAuth = {
  ...identity,
  id: 'identity-auth',
  prefix: '/api/identity/v1/auth',
  policies: ['rate-auth', 'body-1m'],
  priority: 200,
};
const media = {
  id: 'media',
  entrypoint: 'web',
  prefix: '/api/media/v1',
  strip: '/api/media',
  backend: { service: 'media', port: 3000 },
  policies: ['rate-api'],
};
const storage = {
  id: 'storage',
  entrypoint: 'storage',
  prefix: '/',
  backend: { service: 'object-store', port: 8333, namespace: 'netverse-data' },
  policies: [],
};
const web = {
  id: 'web',
  entrypoint: 'web',
  prefix: '/',
  backend: { service: 'web-3d', port: 80 },
  policies: ['rate-api'],
  priority: 1,
};
const wsGame = {
  id: 'ws-game',
  entrypoint: 'web',
  prefix: '/ws/game',
  backend: { service: 'game', port: 8080 },
  policies: [],
  enabled: false,
};
const wsProbe = {
  id: 'ws-probe',
  entrypoint: 'web',
  prefix: '/ws/_probe',
  strip: '/ws/_probe',
  backend: { service: 'gateway-probe', port: 80 },
  policies: [],
  environments: ['compose', 'k8s-conformance'],
};

function k8sDocs(doc, environment) {
  return parseAllDocuments(renderKubernetes(doc, { environment })).map((item) => item.toJS());
}

test('từ chối hai route trùng prefix trên cùng entrypoint', () => {
  const errors = validateRoutes(baseDoc([identity, { ...identity, id: 'identity-copy' }]));
  assert.ok(errors.some((error) => error.includes('duplicate prefix /api/identity/v1')));
});

test('cho phép cùng prefix ở hai entrypoint khác nhau', () => {
  assert.deepEqual(validateRoutes(baseDoc([web, storage])), []);
});

test('từ chối route API không theo dạng /api/<service>/v<n>', () => {
  const errors = validateRoutes(baseDoc([{ ...identity, prefix: '/identity/v1' }]));
  assert.ok(
    errors.some((error) => error.includes('identity') && error.includes('/api/<service>/v<n>')),
  );
});

test('từ chối strip không khớp tiền tố service', () => {
  const errors = validateRoutes(baseDoc([{ ...media, strip: '/api/identity' }]));
  assert.ok(errors.some((error) => error.includes('media') && error.includes('strip')));
});

test('từ chối prefix chứa .., ký tự mã hoá hoặc //', () => {
  for (const prefix of [
    '/api/media/v1/..',
    '/api/media/v1/%2e',
    '/api/media//v1',
    '/api/media/v1/',
  ]) {
    const errors = validateRoutes(baseDoc([{ ...media, prefix }]));
    assert.ok(errors.length > 0, `prefix ${prefix} must be rejected`);
  }
});

test('từ chối policy chưa khai báo', () => {
  const errors = validateRoutes(baseDoc([{ ...media, policies: ['rate-unknown'] }]));
  assert.ok(errors.some((error) => error.includes('rate-unknown')));
});

test('rule Compose khớp theo phần tử đường dẫn', () => {
  const config = parse(renderCompose(baseDoc([media])));
  assert.equal(
    config.http.routers.media.rule,
    'Path(`/api/media/v1`) || PathPrefix(`/api/media/v1/`)',
  );
});

test('strip đứng cuối danh sách middleware', () => {
  const config = parse(renderCompose(baseDoc([identity])));
  assert.deepEqual(config.http.routers.identity.middlewares, [
    'rate-api',
    'body-1m',
    'strip-identity',
  ]);
  assert.deepEqual(config.http.middlewares['strip-identity'], {
    stripPrefix: { prefixes: ['/api/identity'] },
  });
});

test('route auth có priority cao hơn route identity', () => {
  const config = parse(renderCompose(baseDoc([identity, identityAuth])));
  const authPriority = config.http.routers['identity-auth'].priority;
  const identityRule = config.http.routers.identity.rule;
  assert.equal(authPriority, 200);
  assert.ok(authPriority > identityRule.length);
});

test('route tắt hoặc khác môi trường không được sinh', () => {
  const doc = baseDoc([media, wsGame, wsProbe]);
  const compose = parse(renderCompose(doc));
  assert.deepEqual(Object.keys(compose.http.routers).sort(), ['media', 'ws-probe']);
  const k8sNames = k8sDocs(doc, 'k8s').map((item) => item.metadata.name);
  assert.deepEqual(k8sNames, ['media']);
  const conformanceNames = k8sDocs(doc, 'k8s-conformance').map((item) => item.metadata.name);
  assert.deepEqual(conformanceNames, ['ws-probe']);
});

test('HTTPRoute cắt tiền tố bằng ReplacePrefixMatch giữ /v1', () => {
  const [route] = k8sDocs(baseDoc([identityAuth]), 'k8s');
  const rule = route.spec.rules[0];
  assert.deepEqual(rule.matches, [
    { path: { type: 'PathPrefix', value: '/api/identity/v1/auth' } },
  ]);
  assert.deepEqual(rule.filters.at(-1), {
    type: 'URLRewrite',
    urlRewrite: { path: { type: 'ReplacePrefixMatch', replacePrefixMatch: '/v1/auth' } },
  });
  assert.deepEqual(rule.filters[0], {
    type: 'ExtensionRef',
    extensionRef: { group: 'traefik.io', kind: 'Middleware', name: 'rate-auth' },
  });
  const [probe] = k8sDocs(baseDoc([wsProbe]), 'k8s-conformance');
  assert.equal(probe.spec.rules[0].filters.at(-1).urlRewrite.path.replacePrefixMatch, '/');
});

test('route sang namespace khác sinh kèm ReferenceGrant', () => {
  const docs = k8sDocs(baseDoc([storage]), 'k8s');
  const route = docs.find((item) => item.kind === 'HTTPRoute');
  const grant = docs.find((item) => item.kind === 'ReferenceGrant');
  assert.deepEqual(route.spec.rules[0].backendRefs, [
    { name: 'object-store', namespace: 'netverse-data', port: 8333 },
  ]);
  assert.equal(grant.metadata.namespace, 'netverse-data');
  assert.deepEqual(grant.spec.from, [
    { group: 'gateway.networking.k8s.io', kind: 'HTTPRoute', namespace: 'netverse' },
  ]);
  assert.deepEqual(grant.spec.to, [{ group: '', kind: 'Service', name: 'object-store' }]);
});

test('tệp sinh chỉ có một dòng chú thích là header Code generated', () => {
  const doc = baseDoc([identity, identityAuth, media, storage, web, wsProbe]);
  for (const output of [
    renderCompose(doc),
    renderKubernetes(doc, { environment: 'k8s' }),
    renderKubernetes(doc, { environment: 'k8s-conformance' }),
    renderKubernetesMiddlewares(doc),
  ]) {
    const commentLines = output.split('\n').filter((line) => /^\s*#/.test(line) || / #/.test(line));
    assert.deepEqual(commentLines, [GENERATED_HEADER]);
    assert.ok(output.startsWith(`${GENERATED_HEADER}\n`));
  }
});

test('báo service sau cổng chưa đặt TRUST_PROXY_HOPS=1', () => {
  const compose = {
    services: {
      identity: { environment: { TRUST_PROXY_HOPS: '1' } },
      media: { environment: { NODE_ENV: 'development' } },
      'web-3d': {},
    },
  };
  assert.deepEqual(findUntrustedBackends(baseDoc([identity, media, web]), compose), ['media']);
});
