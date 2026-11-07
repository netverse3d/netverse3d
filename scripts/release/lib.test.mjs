import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareVersions,
  evaluateChecks,
  evaluatePlacement,
  evaluateRelease,
  parseTag,
  previousTag,
  selectChangedComponents,
  stagingTagsUpTo,
  tagFor,
} from './lib.mjs';

const staging = {
  environment: 'staging',
  version: '1.4.0',
  branch: 'staging',
  tagExists: false,
  peerExists: false,
  sameTree: false,
};
const production = {
  environment: 'production',
  version: '1.4.0',
  branch: 'main',
  tagExists: false,
  peerExists: true,
  sameTree: true,
};

for (const version of ['1.04.0', '1.4', 'v1.4.0', '1.4.0-rc.1', '', undefined]) {
  test(`từ chối phiên bản sai định dạng: ${version}`, () => {
    assert.match(evaluateRelease({ ...staging, version }).join(), /Version must look like/);
  });
}

test('từ chối môi trường lạ', () => {
  assert.match(evaluateRelease({ ...staging, environment: 'dev' }).join(), /Unknown environment/);
});

test('staging chạy được trên nhánh staging và hotfix', () => {
  assert.deepEqual(evaluateRelease(staging), []);
  assert.deepEqual(evaluateRelease({ ...staging, branch: 'hotfix/1.4.1-pay' }), []);
});

test('staging không chạy trên nhánh khác', () => {
  const errors = evaluateRelease({ ...staging, branch: 'main' }).join();
  assert.match(errors, /stg-v1\.4\.0 must be on staging or hotfix/);
});

test('production chỉ chạy trên main', () => {
  const errors = evaluateRelease({ ...production, branch: 'staging' }).join();
  assert.match(errors, /prod-v1\.4\.0 must be on main/);
});

test('production cần có bản staging cùng số', () => {
  const errors = evaluateRelease({ ...production, peerExists: false }).join();
  assert.match(errors, /stg-v1\.4\.0 does not exist/);
});

test('production cần cùng nội dung với bản staging', () => {
  const errors = evaluateRelease({ ...production, sameTree: false }).join();
  assert.match(errors, /content differs from stg-v1\.4\.0/);
});

test('production hợp lệ khi đủ điều kiện', () => {
  assert.deepEqual(evaluateRelease(production), []);
});

test('không dùng lại tag đã có', () => {
  assert.match(evaluateRelease({ ...staging, tagExists: true }).join(), /already exists/);
});

test('tag đã tạo nằm trên nhánh hotfix được chấp nhận cho staging', () => {
  const result = evaluatePlacement({
    environment: 'staging',
    version: '1.4.1',
    branches: ['hotfix/1.4.1-pay', 'feat/x'],
  });
  assert.deepEqual(result, []);
});

test('đọc đúng tag hợp lệ và từ chối tag sai', () => {
  assert.deepEqual(parseTag('stg-v1.4.0'), { environment: 'staging', version: '1.4.0' });
  assert.deepEqual(parseTag('prod-v1.4.0'), { environment: 'production', version: '1.4.0' });
  for (const tag of ['v1.4.0', 'stg-v1.04.0', 'stg-1.4.0', 'staging-v1.4.0', 'prod-v1.4.0-rc.1']) {
    assert.equal(parseTag(tag), null, tag);
  }
});

test('tạo tên tag theo môi trường', () => {
  assert.equal(tagFor('staging', '1.0.0'), 'stg-v1.0.0');
  assert.equal(tagFor('production', '1.0.0'), 'prod-v1.0.0');
});

test('chặn khi check bắt buộc chưa chạy hoặc chưa đạt', () => {
  const errors = evaluateChecks([
    { name: 'verify', status: 'in_progress', conclusion: null },
  ]).join();
  assert.match(errors, /"verify" is in_progress/);
  assert.match(errors, /"secrets" has not run/);
});

test('cho qua khi mọi check bắt buộc đều đạt', () => {
  const runs = [
    { name: 'verify', conclusion: 'success' },
    { name: 'secrets', conclusion: 'success' },
  ];
  assert.deepEqual(evaluateChecks(runs), []);
});

test('so sánh phiên bản theo số, không theo chữ', () => {
  assert.ok(compareVersions('0.10.0', '0.2.0') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
});

test('tìm tag trước đó trong cùng môi trường', () => {
  const tags = ['stg-v0.2.0', 'stg-v0.10.0', 'prod-v0.9.0', 'stg-v0.9.0', 'other'];
  assert.equal(previousTag(tags, 'stg-v0.10.0'), 'stg-v0.9.0');
  assert.equal(previousTag(tags, 'stg-v0.2.0'), null);
  assert.equal(previousTag(tags, 'prod-v0.10.0'), 'prod-v0.9.0');
});

test('liệt kê bản staging từ mới đến cũ, không vượt quá phiên bản đang phát hành', () => {
  const tags = ['stg-v0.1.0', 'stg-v0.10.0', 'stg-v0.2.0', 'prod-v0.2.0', 'stg-v0.2.1'];
  assert.deepEqual(stagingTagsUpTo(tags, '0.2.0'), ['stg-v0.2.0', 'stg-v0.1.0']);
});

const components = [
  { id: 'identity', path: 'services/identity', hasDockerfile: true },
  { id: 'media', path: 'services/media', hasDockerfile: true },
  { id: 'world', path: 'services/world', hasDockerfile: false },
];

test('chỉ build thành phần có thay đổi', () => {
  const changed = selectChangedComponents(components, ['services/identity/src/a.ts', 'README.md']);
  assert.deepEqual(
    changed.map((item) => item.id),
    ['identity'],
  );
});

test('thành phần chưa có Dockerfile không được build', () => {
  assert.deepEqual(selectChangedComponents(components, ['services/world/src/a.ts']), []);
});

test('đổi package dùng chung thì build mọi thành phần', () => {
  const changed = selectChangedComponents(components, ['packages/contracts/events/a.json']);
  assert.equal(changed.length, 2);
});

test('lần phát hành đầu tiên build mọi thành phần', () => {
  assert.equal(selectChangedComponents(components, null).length, 2);
});

test('chỉ đổi tài liệu thì không build gì', () => {
  assert.deepEqual(selectChangedComponents(components, ['docs/wiki/index.md']), []);
});
