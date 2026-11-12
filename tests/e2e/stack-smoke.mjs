import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const IDENTITY_URL = process.env.SMOKE_IDENTITY_URL ?? 'http://127.0.0.1:53002';
const MEDIA_URL = process.env.SMOKE_MEDIA_URL ?? 'http://127.0.0.1:53001';
const OTP_PORT = Number(process.env.SMOKE_OTP_PORT ?? 4100);
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-admin-password';
const RUN = Date.now();
const PLAYER_EMAIL = `player-${RUN}@example.test`;
const OWNER_EMAIL = `owner-${RUN}@example.test`;
const PASSWORD = 'smoke-password-123';
const CONTENT = Buffer.from('stack smoke payload');
const CONTENT_TYPE = 'image/png';

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
  if (codes.has(email)) return Promise.resolve(codes.get(email));
  return new Promise((resolve, reject) => {
    waiters.set(email, resolve);
    setTimeout(() => reject(new Error(`no one-time code arrived for ${email}`)), 15_000);
  });
}

async function call(base, method, path, body, bearer) {
  const response = await fetch(`${base}${path}`, {
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

const identity = (method, path, body, bearer) => call(IDENTITY_URL, method, path, body, bearer);
const media = (method, path, body, bearer) => call(MEDIA_URL, method, path, body, bearer);

function claims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

async function registerAndVerify(email) {
  const registered = await identity('POST', '/v1/auth/register', { email, password: PASSWORD });
  assert.equal(registered.status, 202, JSON.stringify(registered.body));
  const verified = await identity('POST', '/v1/auth/verify-email', {
    email,
    code: await waitForCode(email),
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
}

async function login(email, password, tenantId) {
  const result = await identity('POST', '/v1/auth/login', {
    email,
    password,
    ...(tenantId ? { tenantId } : {}),
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.result.accessToken;
}

async function uploadAs(bearer, ownerId) {
  const issued = await media(
    'POST',
    '/v1/media/issue-upload-url',
    {
      contentType: CONTENT_TYPE,
      declaredSizeBytes: CONTENT.length,
      ownerType: 'avatar',
      ownerId,
      originalFilename: 'smoke.png',
    },
    bearer,
  );
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const put = await fetch(issued.body.result.uploadUrl, {
    method: 'PUT',
    headers: issued.body.result.requiredHeaders,
    body: CONTENT,
  });
  assert.equal(put.status, 200, `upload failed: ${await put.text()}`);
  const id = issued.body.result.mediaId;
  const completed = await media('POST', `/v1/media/${id}/complete`, undefined, bearer);
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(completed.body.result.status, 'ACTIVE');
  return id;
}

async function downloadAs(bearer, id) {
  const link = await media('POST', `/v1/media/${id}/issue-download-url`, {}, bearer);
  assert.equal(link.status, 200, JSON.stringify(link.body));
  const file = await fetch(link.body.result.downloadUrl);
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), CONTENT);
}

try {
  const anonymous = await media('GET', '/v1/media?size=1');
  assert.equal(anonymous.status, 401, JSON.stringify(anonymous.body));
  console.log('media rejects a request without a token ok');

  await registerAndVerify(PLAYER_EMAIL);
  const playerToken = await login(PLAYER_EMAIL, PASSWORD);
  assert.equal(claims(playerToken).tenant_id, undefined);
  console.log('player registers, verifies and logs in at identity ok');

  const playerFile = await uploadAs(playerToken, 'player-avatar');
  await downloadAs(playerToken, playerFile);
  console.log('player uploads and downloads at media with the identity token ok');

  await registerAndVerify(OWNER_EMAIL);
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const tenant = await identity(
    'POST',
    '/v1/tenants',
    { slug: `shop-${RUN}`, name: 'Smoke Shop' },
    adminToken,
  );
  assert.equal(tenant.status, 201, JSON.stringify(tenant.body));
  const tenantId = tenant.body.result.id;
  const role = await identity(
    'PUT',
    `/v1/tenants/${tenantId}/roles`,
    { name: 'owner', permissions: ['shop:manage'] },
    adminToken,
  );
  assert.equal(role.status, 200, JSON.stringify(role.body));
  const member = await identity(
    'POST',
    `/v1/tenants/${tenantId}/members`,
    { email: OWNER_EMAIL, roles: ['owner'] },
    adminToken,
  );
  assert.equal(member.status, 201, JSON.stringify(member.body));
  const ownerToken = await login(OWNER_EMAIL, PASSWORD, tenantId);
  assert.equal(claims(ownerToken).tenant_id, tenantId);
  assert.deepEqual(claims(ownerToken).roles, ['owner']);
  console.log('shop tenant, owner role and tenant-scoped token ok');

  const shopFile = await uploadAs(ownerToken, 'shop-sign');
  await downloadAs(ownerToken, shopFile);
  console.log('owner uploads and downloads inside the shop tenant ok');

  const outsider = await media('GET', `/v1/media/${shopFile}`, undefined, playerToken);
  assert.equal(outsider.status, 404, JSON.stringify(outsider.body));
  console.log('a token outside the shop tenant cannot see the shop file ok');

  console.log('STACK SMOKE PASSED');
} finally {
  otpSink.close();
}
