import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const OTP_PORT = Number(process.env.SMOKE_OTP_PORT ?? 4100);
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-admin-password';
const EMAIL = `smoke-${Date.now()}@example.test`;
const PASSWORD = 'smoke-password-123';

const codes = new Map();
const waiters = new Map();

const otpSink = createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => (body += chunk));
  request.on('end', () => {
    const message = JSON.parse(body);
    codes.set(message.email, message.code);
    waiters.get(message.email)?.(message.code);
    response.end('{}');
  });
});
await new Promise((resolve) => otpSink.listen(OTP_PORT, '0.0.0.0', resolve));

function waitForCode(email) {
  if (codes.has(email)) {
    return Promise.resolve(codes.get(email));
  }
  return new Promise((resolve, reject) => {
    waiters.set(email, resolve);
    setTimeout(() => reject(new Error('no one-time code arrived')), 15_000);
  });
}

async function api(method, path, body, bearer) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function claims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

try {
  const registered = await api('POST', '/v1/auth/register', { email: EMAIL, password: PASSWORD });
  assert.equal(registered.status, 202, JSON.stringify(registered.body));
  const verified = await api('POST', '/v1/auth/verify-email', {
    email: EMAIL,
    code: await waitForCode(EMAIL),
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  console.log('register and verify ok');

  const login = await api('POST', '/v1/auth/login', { email: EMAIL, password: PASSWORD });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  console.log('login ok');

  const me = await api('GET', '/v1/me', undefined, login.body.result.accessToken);
  assert.equal(me.status, 200, JSON.stringify(me.body));
  assert.equal(me.body.result.email, EMAIL);
  console.log('token verified through jwks ok');

  const refreshed = await api('POST', '/v1/auth/refresh', {
    refreshToken: login.body.result.refreshToken,
  });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  console.log('refresh ok');

  const admin = await api('POST', '/v1/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  assert.equal(admin.status, 200, JSON.stringify(admin.body));
  const adminToken = admin.body.result.accessToken;

  const tenant = await api(
    'POST',
    '/v1/tenants',
    { slug: `smoke-${Date.now()}`, name: 'Smoke' },
    adminToken,
  );
  assert.equal(tenant.status, 201, JSON.stringify(tenant.body));
  const tenantId = tenant.body.result.id;
  assert.equal(
    (
      await api(
        'PUT',
        `/v1/tenants/${tenantId}/roles`,
        { name: 'editor', permissions: ['media:write'] },
        adminToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await api(
        'POST',
        `/v1/tenants/${tenantId}/members`,
        { email: EMAIL, roles: ['editor'] },
        adminToken,
      )
    ).status,
    201,
  );
  const scoped = await api('POST', '/v1/auth/login', {
    email: EMAIL,
    password: PASSWORD,
    tenantId,
  });
  assert.equal(scoped.status, 200, JSON.stringify(scoped.body));
  assert.deepEqual(claims(scoped.body.result.accessToken).roles, ['editor']);
  assert.equal(claims(scoped.body.result.accessToken).tenant_id, tenantId);
  console.log('tenant membership ok');

  const rotated = await api('POST', '/v1/admin/keys/rotate', undefined, adminToken);
  assert.equal(rotated.status, 200, JSON.stringify(rotated.body));
  const stillValid = await api('GET', '/v1/me', undefined, scoped.body.result.accessToken);
  assert.equal(stillValid.status, 200, JSON.stringify(stillValid.body));
  console.log('key rotation ok');

  const loggedOut = await api('POST', '/v1/auth/logout', {
    refreshToken: scoped.body.result.refreshToken,
  });
  assert.equal(loggedOut.status, 200);
  const afterLogout = await api('GET', '/v1/me', undefined, scoped.body.result.accessToken);
  assert.equal(afterLogout.status, 401);
  console.log('logout ok');

  const keys = await api('GET', '/.well-known/jwks.json');
  assert.equal(keys.status, 200);
  assert.equal(keys.body.keys.length, 2);
  assert.ok(keys.body.keys.every((key) => key.d === undefined));
  console.log('jwks ok');

  console.log('SMOKE PASSED');
} finally {
  otpSink.close();
}
