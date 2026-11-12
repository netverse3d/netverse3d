import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareVersions,
  contentPaths,
  evaluateChecks,
  evaluatePlacement,
  evaluateRelease,
  latestVersion,
  parseTag,
  tagFor,
} from './lib.mjs';

const staging = {
  component: 'identity',
  deployable: true,
  environment: 'staging',
  version: '1.4.0',
  branch: 'staging',
  tagExists: false,
  peerExists: false,
  sameContent: false,
  previousVersion: null,
};
const production = {
  component: 'identity',
  deployable: true,
  environment: 'production',
  version: '1.4.0',
  branch: 'main',
  tagExists: false,
  peerExists: true,
  sameContent: true,
  previousVersion: null,
};

for (const version of ['1.04.0', '1.4', 'v1.4.0', '1.4.0-rc.1', '', undefined]) {
  test(`từ chối phiên bản sai định dạng: ${version}`, () => {
    assert.match(evaluateRelease({ ...staging, version }).join(), /Version must look like/);
  });
}

test('từ chối môi trường lạ', () => {
  assert.match(evaluateRelease({ ...staging, environment: 'qa' }).join(), /Unknown environment/);
});

test('từ chối thành phần không triển khai được hoặc không có trong catalog', () => {
  const errors = evaluateRelease({ ...staging, component: 'contracts', deployable: false }).join();
  assert.match(errors, /"contracts" is not a deployable component/);
});

test('từ chối khi thiếu tên thành phần', () => {
  const errors = evaluateRelease({ ...staging, component: undefined, deployable: false }).join();
  assert.match(errors, /Component is required/);
});

test('staging chỉ chạy được trên nhánh staging', () => {
  assert.deepEqual(evaluateRelease(staging), []);
});

test('staging không chạy trên nhánh khác', () => {
  const errors = evaluateRelease({ ...staging, branch: 'main' }).join();
  assert.match(errors, /identity\/stg-v1\.4\.0 must be on staging/);
});

test('production chỉ chạy trên main', () => {
  const errors = evaluateRelease({ ...production, branch: 'staging' }).join();
  assert.match(errors, /identity\/prod-v1\.4\.0 must be on main/);
});

test('production cần có bản staging cùng số của chính thành phần đó', () => {
  const errors = evaluateRelease({ ...production, peerExists: false }).join();
  assert.match(errors, /identity\/stg-v1\.4\.0 does not exist/);
});

test('production cần nội dung của thành phần giống bản staging', () => {
  const errors = evaluateRelease({ ...production, sameContent: false }).join();
  assert.match(errors, /content of identity differs from identity\/stg-v1\.4\.0/);
});

test('production hợp lệ khi đủ điều kiện', () => {
  assert.deepEqual(evaluateRelease(production), []);
});

test('không dùng lại tag đã có', () => {
  assert.match(evaluateRelease({ ...staging, tagExists: true }).join(), /already exists/);
});

test('số phiên bản phải lớn hơn bản trước của chính thành phần đó', () => {
  const lower = evaluateRelease({ ...staging, version: '1.3.9', previousVersion: '1.4.0' }).join();
  assert.match(lower, /1\.3\.9 must be greater than 1\.4\.0/);
  assert.deepEqual(evaluateRelease({ ...staging, version: '1.4.1', previousVersion: '1.4.0' }), []);
});

test('từ chối phát hành khi đang chạy trên tag thay vì nhánh', () => {
  const errors = evaluateRelease({ ...staging, refType: 'tag' }).join();
  assert.match(errors, /must run on a branch/);
  assert.deepEqual(evaluateRelease({ ...staging, refType: 'branch' }), []);
});

test('tag staging nằm trên nhánh staging được chấp nhận', () => {
  const result = evaluatePlacement({
    component: 'identity',
    environment: 'staging',
    version: '1.4.1',
    branches: ['staging', 'feat/x'],
  });
  assert.deepEqual(result, []);
});

test('đọc đúng tag có mã thành phần và từ chối tag sai', () => {
  assert.deepEqual(parseTag('identity/stg-v1.4.0'), {
    component: 'identity',
    environment: 'staging',
    version: '1.4.0',
  });
  assert.deepEqual(parseTag('web-3d/prod-v1.4.0'), {
    component: 'web-3d',
    environment: 'production',
    version: '1.4.0',
  });
  for (const tag of [
    'stg-v1.4.0',
    'prod-v1.4.0',
    'v1.4.0',
    'identity/v1.4.0',
    'identity/stg-v1.04.0',
    'identity/stg-1.4.0',
    'identity/staging-v1.4.0',
    'identity/prod-v1.4.0-rc.1',
    'Identity/stg-v1.4.0',
    'services/identity/stg-v1.4.0',
    '/stg-v1.4.0',
  ]) {
    assert.equal(parseTag(tag), null, tag);
  }
});

test('tạo tên tag theo thành phần và môi trường', () => {
  assert.equal(tagFor('identity', 'staging', '1.0.0'), 'identity/stg-v1.0.0');
  assert.equal(tagFor('web-3d', 'production', '1.0.0'), 'web-3d/prod-v1.0.0');
});

test('bản mới nhất chỉ tính tag của đúng thành phần và đúng môi trường', () => {
  const tags = [
    'identity/stg-v0.9.0',
    'identity/stg-v0.10.0',
    'identity/prod-v0.9.0',
    'media/stg-v3.0.0',
    'stg-v9.9.9',
    'note',
  ];
  assert.equal(latestVersion(tags, 'identity', 'staging'), '0.10.0');
  assert.equal(latestVersion(tags, 'identity', 'production'), '0.9.0');
  assert.equal(latestVersion(tags, 'media', 'production'), null);
});

test('so sánh phiên bản theo số, không theo chữ', () => {
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.ok(compareVersions('1.0.0', '0.99.99') > 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
});

test('nội dung của thành phần gồm thư mục của nó, package nó phụ thuộc và tệp gốc dùng chung', () => {
  const components = [
    { id: 'identity', path: 'services/identity' },
    { id: 'nest-kit', path: 'packages/nest-kit' },
    { id: 'contracts', path: 'packages/contracts' },
    { id: 'media', path: 'services/media' },
  ];
  const dependencies = new Map([
    ['identity', ['nest-kit']],
    ['nest-kit', ['contracts']],
    ['contracts', []],
    ['media', ['contracts']],
  ]);
  const paths = contentPaths(components[0], components, dependencies);
  assert.deepEqual(paths.slice(0, 3), [
    'services/identity',
    'packages/nest-kit',
    'packages/contracts',
  ]);
  assert.ok(paths.includes('pnpm-lock.yaml'));
  assert.ok(!paths.includes('services/media'));
});

test('không cho qua khi có một lần chạy cùng tên bị lỗi', () => {
  const app = { slug: 'github-actions' };
  const runs = [
    { name: 'verify', conclusion: 'success', app },
    { name: 'verify', conclusion: 'failure', app },
    { name: 'secrets', conclusion: 'success', app },
  ];
  assert.match(evaluateChecks(runs).join(), /"verify" is failure/);
});

test('chặn khi check bắt buộc chưa chạy hoặc chưa đạt', () => {
  const errors = evaluateChecks([
    { name: 'verify', status: 'in_progress', conclusion: null, app: { slug: 'github-actions' } },
  ]).join();
  assert.match(errors, /"verify" is in_progress/);
  assert.match(errors, /"secrets" has not run/);
});

test('cho qua khi mọi check bắt buộc đều đạt', () => {
  const runs = [
    { name: 'verify', conclusion: 'success', app: { slug: 'github-actions' } },
    { name: 'secrets', conclusion: 'success', app: { slug: 'github-actions' } },
  ];
  assert.deepEqual(evaluateChecks(runs), []);
});

test('không tin check cùng tên nhưng không do GitHub Actions tạo', () => {
  const runs = [
    { name: 'verify', conclusion: 'success', app: { slug: 'someone-else' } },
    { name: 'secrets', conclusion: 'success', app: { slug: 'github-actions' } },
  ];
  assert.match(evaluateChecks(runs).join(), /"verify" has not run/);
});
