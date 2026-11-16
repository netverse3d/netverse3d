import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rawRequest, websocketEcho } from '../lib/http.mjs';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:58080';
const GATEWAY_STORAGE_URL = process.env.GATEWAY_STORAGE_URL ?? 'http://127.0.0.1:58334';
const WS_PROBE_ENABLED = process.env.GATEWAY_WS_PROBE === '1';
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-admin-password';
const SPOOFED_IP = '203.0.113.77';
const SERVICES = ['identity', 'media', 'notification', 'payment'];
const ONE_MEBIBYTE = 1024 * 1024;

async function send(path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text, json: parseJson(text) };
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function describe(path, response) {
  return `${path} -> ${response.status} ${response.text.slice(0, 200)}`;
}

function isServiceError(response) {
  return typeof response.json?.code === 'string' && typeof response.json?.requestId === 'string';
}

test('chuyển tới đúng service và cắt tiền tố', async () => {
  const providers = await send('/api/identity/v1/auth/providers');
  assert.equal(providers.status, 200, describe('providers', providers));
  assert.ok(providers.json, 'providers must answer JSON');

  for (const path of ['/api/media/v1/media', '/api/notification/v1/inbox']) {
    const response = await send(path);
    assert.equal(response.status, 401, describe(path, response));
    assert.ok(isServiceError(response), describe(path, response));
    assert.ok(response.headers.get('x-request-id'), `${path} must carry x-request-id`);
  }

  const webhook = await send('/api/payment/v1/webhooks/unknown', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.ok(webhook.status >= 400 && webhook.status < 500, describe('webhook', webhook));
  assert.ok(isServiceError(webhook), describe('webhook', webhook));
});

test('không lộ đường nội bộ của service', async () => {
  const paths = SERVICES.flatMap((service) =>
    ['healthz', 'livez', 'docs', 'docs-json', 'metrics'].map((leaf) => `/api/${service}/${leaf}`),
  );
  paths.push(
    '/api/identity/.well-known/jwks.json',
    '/api/payment/v1/payment-intents',
    '/api/payment/v1/internal/tenants',
    '/api/payment/v1/customers',
  );
  for (const path of paths) {
    const response = await send(path);
    assert.equal(response.status, 404, describe(path, response));
    assert.ok(!isServiceError(response), `${path} reached a service: ${describe(path, response)}`);
  }
});

test('không thoát khỏi tiền tố bằng .. hoặc ký tự mã hoá', async () => {
  const paths = [
    '/api/identity/v1/../../docs',
    '/api/identity/v1/..%2F..%2Fdocs',
    '/api/identity/v1/%2e%2e/%2e%2e/healthz',
    '/api/media/v1/%2e%2e/%2e%2e/livez',
  ];
  for (const path of paths) {
    const response = await rawRequest({ url: GATEWAY_URL, path });
    assert.ok([400, 404].includes(response.status), `${path} -> ${response.status}`);
    assert.ok(!response.body.toLowerCase().includes('swagger'), `${path} exposed swagger`);
    assert.ok(!response.body.includes('"status":"ok"'), `${path} exposed a health probe`);
  }
});

function headerFromProbe(text, name) {
  const line = text
    .split(/\r?\n/)
    .find((item) => item.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line ? line.slice(name.length + 1).trim() : null;
}

function normalizedIp(ip) {
  return ip?.replace(/^::ffff:/, '') ?? null;
}

test('không nhận X-Forwarded-For giả mạo', async (t) => {
  if (!WS_PROBE_ENABLED) {
    t.skip('the probe route is needed to learn which client IP the gateway forwards');
    return;
  }
  const probe = await send('/ws/_probe/', { headers: { 'x-forwarded-for': SPOOFED_IP } });
  assert.equal(probe.status, 200, describe('probe', probe));
  const forwardedFor = headerFromProbe(probe.text, 'X-Forwarded-For');
  const gatewayIp = headerFromProbe(probe.text, 'RemoteAddr')?.replace(/:\d+$/, '');
  assert.ok(
    forwardedFor && gatewayIp,
    `probe did not report addresses: ${probe.text.slice(0, 200)}`,
  );
  assert.ok(
    !forwardedFor.includes(SPOOFED_IP),
    `gateway forwarded the spoofed IP: ${forwardedFor}`,
  );

  const requestId = `gw-xff-${Date.now()}`;
  const login = await send('/api/identity/v1/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': SPOOFED_IP,
      'x-request-id': requestId,
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200, describe('login', login));
  const token = login.json.result.accessToken;

  const audit = await send('/api/identity/v1/audit-logs?action=auth.login', {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(audit.status, 200, describe('audit-logs', audit));
  const entry = audit.json.result.content.find((item) => item.requestId === requestId);
  assert.ok(entry, `no audit entry for request ${requestId}`);
  assert.equal(
    normalizedIp(entry.ip),
    forwardedFor,
    `audit recorded ${entry.ip}; the gateway is ${gatewayIp}, the client is ${forwardedFor}`,
  );
  assert.notEqual(normalizedIp(entry.ip), gatewayIp, 'the service does not trust the gateway hop');
});

test('chặn yêu cầu vượt 1 MiB', async () => {
  const big = JSON.stringify({ padding: 'x'.repeat(2 * ONE_MEBIBYTE) });
  const tooLarge = await send('/api/identity/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: big,
  });
  assert.equal(tooLarge.status, 413, describe('2 MiB body', tooLarge));

  const empty = await send('/api/identity/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(empty.status, 400, describe('empty body', empty));
  assert.ok(empty.headers.get('x-request-id'), 'the service answer must carry x-request-id');
});

test('phục vụ web ở gốc với header an toàn', async () => {
  const response = await send('/');
  assert.equal(response.status, 200, describe('/', response));
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('không mở API, dashboard, ping, metric của Traefik ra ngoài', async () => {
  for (const path of ['/dashboard/', '/api/rawdata', '/ping', '/metrics']) {
    const response = await send(path);
    assert.equal(response.status, 404, describe(path, response));
    assert.ok(!response.text.includes('traefik_'), `${path} exposed Traefik metrics`);
  }
});

test('giữ request id hợp lệ của client', async () => {
  const response = await send('/api/identity/v1/auth/providers', {
    headers: { 'x-request-id': 'gw-conformance-0001' },
  });
  assert.equal(response.status, 200, describe('providers', response));
  assert.equal(response.headers.get('x-request-id'), 'gw-conformance-0001');
});

test('nâng cấp WebSocket qua cổng', async (t) => {
  if (!WS_PROBE_ENABLED) {
    t.skip('websocket probe route is not deployed');
    return;
  }
  const echo = await websocketEcho({
    url: GATEWAY_URL,
    path: '/ws/_probe/echo',
    message: 'ping-gateway',
  });
  assert.equal(echo.status, 101);
  assert.equal(echo.text, 'ping-gateway');
});

test('storage đi qua cổng giữ nguyên Host', async () => {
  const response = await fetch(`${GATEWAY_STORAGE_URL}/`, { signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  assert.ok(text.startsWith('<?xml'), `storage answered ${response.status}: ${text.slice(0, 120)}`);
});

test('giới hạn tần suất ở cổng cho đường xác thực', async () => {
  const responses = await Promise.all(
    Array.from({ length: 60 }, () => send('/api/identity/v1/auth/providers')),
  );
  const limited = responses.filter((response) => response.status === 429);
  assert.ok(limited.length > 0, 'no request was rate limited');
  const fromGateway = limited.filter((response) => !response.headers.get('x-request-id'));
  assert.ok(fromGateway.length > 0, 'every 429 came from the service, none from the gateway');
  for (const response of fromGateway) {
    assert.match(
      response.headers.get('retry-after') ?? '',
      /^\d+$/,
      'gateway 429 must carry Retry-After',
    );
  }
});
