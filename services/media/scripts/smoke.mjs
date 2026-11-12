import assert from 'node:assert/strict';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const ISSUER_URL = process.env.SMOKE_ISSUER_URL ?? 'http://127.0.0.1:4000';
const CONTENT = Buffer.from('media smoke payload');
const CONTENT_TYPE = 'image/png';

async function token(subject, roles) {
  const response = await fetch(
    `${ISSUER_URL}/token?sub=${subject}&roles=${roles}&tenant=smoke-tenant`,
  );
  return (await response.json()).token;
}

async function api(method, path, bearer, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function upload(result) {
  const response = await fetch(result.uploadUrl, {
    method: 'PUT',
    headers: result.requiredHeaders,
    body: CONTENT,
  });
  assert.equal(response.status, 200, `upload failed: ${await response.text()}`);
}

async function issueAndUpload(bearer, body) {
  const issued = await api('POST', '/v1/media/issue-upload-url', bearer, body);
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  await upload(issued.body.result);
  return issued.body.result.mediaId;
}

async function assertDownloadable(bearer, id) {
  const link = await api('POST', `/v1/media/${id}/issue-download-url`, bearer, {});
  assert.equal(link.status, 200, JSON.stringify(link.body));
  const file = await fetch(link.body.result.downloadUrl);
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), CONTENT);
}

const owner = await token('smoke-owner', '');

const permanentId = await issueAndUpload(owner, {
  contentType: CONTENT_TYPE,
  declaredSizeBytes: CONTENT.length,
  ownerType: 'avatar',
  ownerId: 'smoke-user',
  originalFilename: 'smoke.png',
});
console.log('upload ok');

const completed = await api('POST', `/v1/media/${permanentId}/complete`, owner);
assert.equal(completed.status, 200, JSON.stringify(completed.body));
assert.equal(completed.body.result.status, 'ACTIVE');
assert.equal(completed.body.result.actualSizeBytes, CONTENT.length);
console.log('complete ok');

await assertDownloadable(owner, permanentId);
console.log('download ok');

const temporaryId = await issueAndUpload(owner, {
  contentType: CONTENT_TYPE,
  declaredSizeBytes: CONTENT.length,
  temporary: true,
});
const temporaryDone = await api('POST', `/v1/media/${temporaryId}/complete`, owner);
assert.equal(temporaryDone.status, 200, JSON.stringify(temporaryDone.body));
const promoted = await api('POST', `/v1/media/${temporaryId}/promote`, owner, {
  ownerType: 'post',
  ownerId: 'smoke-post',
  visibility: 'INTERNAL',
});
assert.equal(promoted.status, 200, JSON.stringify(promoted.body));
assert.equal(promoted.body.result.lifecycle, 'PERMANENT');
await assertDownloadable(owner, temporaryId);
console.log('promote ok');

const missing = await api('POST', '/v1/media/issue-upload-url', owner, {
  contentType: CONTENT_TYPE,
  declaredSizeBytes: CONTENT.length,
  ownerType: 'avatar',
  ownerId: 'smoke-user',
});
const notUploaded = await api('POST', `/v1/media/${missing.body.result.mediaId}/complete`, owner);
assert.equal(notUploaded.body.code, 'MEDIA.OBJECT_MISSING');
console.log('missing object ok');

const listed = await api('GET', '/v1/media?ownerType=avatar&size=5', owner);
assert.equal(listed.status, 200);
assert.ok(listed.body.result.totalElements >= 1);
console.log('list ok');

const deleted = await api('DELETE', `/v1/media/${permanentId}`, owner);
assert.equal(deleted.status, 204);
console.log('delete ok');

const admin = await token('smoke-admin', 'admin');
const audit = await api('GET', '/v1/audit-logs?action=media.complete&size=1', admin);
assert.equal(audit.status, 200);
assert.ok(audit.body.result.totalElements >= 1);
console.log('audit ok');

console.log('SMOKE PASSED');
