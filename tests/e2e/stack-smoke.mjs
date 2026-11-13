import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const IDENTITY_URL = process.env.SMOKE_IDENTITY_URL ?? 'http://127.0.0.1:53002';
const MEDIA_URL = process.env.SMOKE_MEDIA_URL ?? 'http://127.0.0.1:53001';
const NOTIFICATION_URL = process.env.SMOKE_NOTIFICATION_URL ?? 'http://127.0.0.1:53003';
const KAFKA_BROKERS = (process.env.SMOKE_KAFKA_BROKERS ?? '127.0.0.1:59092').split(',');
const OTP_PORT = Number(process.env.SMOKE_OTP_PORT ?? 4100);
const OTP_HOST = process.env.SMOKE_OTP_HOST ?? '127.0.0.1';
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.test';
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'change-me-admin-password';
const RUN = Date.now();
const PLAYER_EMAIL = `player-${RUN}@example.test`;
const OWNER_EMAIL = `owner-${RUN}@example.test`;
const RIVAL_EMAIL = `rival-${RUN}@example.test`;
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
await new Promise((resolve) => otpSink.listen(OTP_PORT, OTP_HOST, resolve));

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
const notification = (method, path, body, bearer) =>
  call(NOTIFICATION_URL, method, path, body, bearer);

async function inboxOf(bearer, eventType) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const inbox = await notification('GET', '/v1/inbox', undefined, bearer);
    assert.equal(inbox.status, 200, JSON.stringify(inbox.body));
    const item = inbox.body.result.content.find((entry) => entry.eventType === eventType);
    if (item) return item;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no inbox item arrived for ${eventType}`);
}

async function eventsOn(topic, matches) {
  const kit = createRequire(new URL('../../packages/nest-kit/package.json', import.meta.url));
  const { KafkaJS } = kit('@confluentinc/kafka-javascript');
  const kafka = new KafkaJS.Kafka({
    kafkaJS: { brokers: KAFKA_BROKERS, clientId: 'stack-smoke', logLevel: KafkaJS.logLevel.ERROR },
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    if (!(await admin.listTopics()).includes(topic)) {
      await admin.createTopics({ topics: [{ topic }] });
    }
  } finally {
    await admin.disconnect();
  }
  const consumer = kafka.consumer({
    kafkaJS: { groupId: 'stack-smoke-' + RUN + '-' + topic, fromBeginning: true },
  });
  await consumer.connect();
  await consumer.subscribe({ topic });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no matching event on ' + topic)), 60_000);
      const listening = consumer.run({
        eachMessage: async ({ message }) => {
          const event = JSON.parse(message.value.toString());
          if (matches(event)) {
            clearTimeout(timer);
            resolve({ event, key: message.key.toString() });
          }
        },
      });
      listening.catch(reject);
    });
  } finally {
    await consumer.disconnect();
  }
}

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

async function uploadAs(bearer, ownerId, visibility = 'PRIVATE') {
  const issued = await media(
    'POST',
    '/v1/media/issue-upload-url',
    {
      contentType: CONTENT_TYPE,
      declaredSizeBytes: CONTENT.length,
      ownerType: 'avatar',
      ownerId,
      originalFilename: 'smoke.png',
      visibility,
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

  const playerId = claims(playerToken).sub;
  const playerFile = await uploadAs(playerToken, playerId, 'INTERNAL');
  await downloadAs(playerToken, playerFile);
  console.log('player uploads and downloads at media with the identity token ok');

  await registerAndVerify(RIVAL_EMAIL);
  const rivalToken = await login(RIVAL_EMAIL, PASSWORD);
  const peeked = await media('GET', `/v1/media/${playerFile}`, undefined, rivalToken);
  assert.equal(peeked.status, 404, JSON.stringify(peeked.body));
  const listed = await media(
    'GET',
    `/v1/media?ownerType=avatar&ownerId=${playerId}`,
    undefined,
    rivalToken,
  );
  assert.equal(listed.body.result.totalElements, 0, JSON.stringify(listed.body));
  const spoofed = await media(
    'POST',
    '/v1/media/issue-upload-url',
    {
      contentType: CONTENT_TYPE,
      declaredSizeBytes: CONTENT.length,
      ownerType: 'avatar',
      ownerId: playerId,
    },
    rivalToken,
  );
  assert.equal(spoofed.status, 403, JSON.stringify(spoofed.body));
  console.log('one player cannot see or overwrite another player file ok');

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
    { name: 'admin', permissions: ['shop:manage'] },
    adminToken,
  );
  assert.equal(role.status, 200, JSON.stringify(role.body));
  const member = await identity(
    'POST',
    `/v1/tenants/${tenantId}/members`,
    { email: OWNER_EMAIL, roles: ['admin'] },
    adminToken,
  );
  assert.equal(member.status, 201, JSON.stringify(member.body));
  const ownerToken = await login(OWNER_EMAIL, PASSWORD, tenantId);
  assert.equal(claims(ownerToken).tenant_id, tenantId);
  assert.deepEqual(claims(ownerToken).roles, ['admin']);
  console.log('shop tenant, owner role and tenant-scoped token ok');

  const shopFile = await uploadAs(ownerToken, 'shop-sign', 'INTERNAL');
  await downloadAs(ownerToken, shopFile);
  console.log('owner uploads and downloads inside the shop tenant ok');

  const outsider = await media('GET', `/v1/media/${shopFile}`, undefined, playerToken);
  assert.equal(outsider.status, 404, JSON.stringify(outsider.body));
  console.log('a token outside the shop tenant cannot see the shop file ok');

  const shopPhoto = await uploadAs(ownerToken, 'shop-photo', 'PUBLIC');
  const seen = await media('GET', `/v1/media/${shopPhoto}`, undefined, playerToken);
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  await downloadAs(playerToken, shopPhoto);
  const removed = await media('DELETE', `/v1/media/${shopPhoto}`, undefined, playerToken);
  assert.equal(removed.status, 404, JSON.stringify(removed.body));
  console.log('a player reads and downloads a public shop file but cannot delete it ok');

  const decision = { decision: 'APPROVED' };
  const selfApproved = await media(
    'POST',
    `/v1/media/${shopFile}/moderation`,
    decision,
    ownerToken,
  );
  assert.equal(selfApproved.status, 403, JSON.stringify(selfApproved.body));
  console.log('a shop admin cannot moderate the shop own content ok');

  for (const file of [shopFile, playerFile]) {
    const approved = await media('POST', `/v1/media/${file}/moderation`, decision, adminToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.result.moderationStatus, 'APPROVED');
  }
  console.log('the platform admin moderates shop and player content ok');

  const eventType = `shop.notice-${RUN}`;
  const template = await notification(
    'POST',
    '/v1/templates',
    {
      eventType,
      channel: 'IN_APP',
      locale: 'en',
      subject: 'Notice for {{name}}',
      body: 'Open at {{hour}}',
    },
    ownerToken,
  );
  assert.equal(template.status, 201, JSON.stringify(template.body));
  const sent = await notification(
    'POST',
    '/v1/notifications',
    {
      eventType,
      recipient: { subject: claims(ownerToken).sub },
      variables: { name: 'Owner', hour: '9' },
      channels: ['IN_APP'],
    },
    ownerToken,
  );
  assert.ok([200, 201, 202].includes(sent.status), JSON.stringify(sent.body));
  const item = await inboxOf(ownerToken, eventType);
  assert.equal(item.title, 'Notice for Owner');
  console.log('a shop admin sends an in-app notification and reads it in the inbox ok');

  const tenantless = await notification('GET', '/v1/inbox', undefined, playerToken);
  assert.equal(tenantless.status, 403, JSON.stringify(tenantless.body));
  assert.equal(tenantless.body.code, 'NOTIFICATION.TENANT_REQUIRED');
  console.log('notification refuses a token without a tenant ok');

  const client = await identity(
    'POST',
    '/v1/admin/service-clients',
    { name: 'smoke-' + RUN, audiences: ['media'], permissions: ['media:read'] },
    adminToken,
  );
  assert.equal(client.status, 201, JSON.stringify(client.body));
  const { id: clientId, clientSecret } = client.body.result;
  const issued = await identity('POST', '/v1/auth/service-token', {
    clientId,
    clientSecret,
    audience: 'media',
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const serviceClaims = claims(issued.body.result.accessToken);
  assert.equal(serviceClaims.client_id, clientId);
  assert.equal(serviceClaims.aud, 'media');
  assert.equal(serviceClaims.tenant_id, undefined);
  console.log('the platform admin creates a service account and it gets a token ok');

  const asUser = await media('GET', '/v1/media?size=1', undefined, issued.body.result.accessToken);
  assert.equal(asUser.status, 403, JSON.stringify(asUser.body));
  const elsewhere = await identity('POST', '/v1/auth/service-token', {
    clientId,
    clientSecret,
    audience: 'notification',
  });
  assert.equal(elsewhere.status, 403, JSON.stringify(elsewhere.body));
  console.log('a service token is refused on user routes and for audiences it was not given ok');

  const registered = await eventsOn(
    'netverse.identity.events.v1',
    (event) => event.type === 'user.registered' && event.data.principalId === playerId,
  );
  assert.equal(registered.event.source, 'identity');
  assert.equal(registered.key, 'platform');
  const joined = await eventsOn(
    'netverse.identity.events.v1',
    (event) => event.type === 'membership.added' && event.data.tenantId === tenantId,
  );
  assert.equal(joined.key, tenantId);
  console.log('identity events reach Kafka, keyed by platform or by shop ok');

  const delivered = await eventsOn(
    'netverse.notification.events.v1',
    (event) => event.type === 'notification.delivery.sent' && event.data.eventType === eventType,
  );
  assert.equal(delivered.key, tenantId);
  assert.deepEqual(Object.keys(delivered.event.data).sort(), [
    'attempts',
    'channel',
    'deliveryId',
    'eventType',
    'notificationId',
    'reason',
    'status',
    'tenantId',
  ]);
  console.log('notification delivery events reach Kafka without the recipient address ok');

  console.log('STACK SMOKE PASSED');
} finally {
  otpSink.close();
}
