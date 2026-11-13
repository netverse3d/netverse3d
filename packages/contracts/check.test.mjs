import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLISHED = JSON.stringify({ $id: 'https://x.test/a', title: 'A', type: 'object' });
const DRAFT = JSON.stringify({
  $id: 'https://x.test/d',
  title: 'D',
  type: 'object',
  'x-status': 'draft',
});

function createRepository(files) {
  const cwd = mkdtempSync(join(tmpdir(), 'contracts-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'staging');
  git('config', 'user.name', 'Sim');
  git('config', 'user.email', 'sim@example.test');
  for (const file of ['check.mjs', 'lib.mjs', 'proto.mjs'])
    cpSync(join(HERE, file), join(cwd, file));
  symlinkSync(resolve(HERE, 'node_modules'), join(cwd, 'node_modules'), 'junction');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(cwd, 'package.json'), '{"type":"module"}\n');
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true });
    writeFileSync(join(cwd, file), content);
  }
  git('add', '-A');
  git('commit', '-qm', 'chore: base');
  return cwd;
}

function check(cwd) {
  return spawnSync(process.execPath, ['check.mjs', '--base', 'HEAD'], { cwd, encoding: 'utf8' });
}

test('tệp lồng trong thư mục con không đổi thì không bị báo là đã xoá', () => {
  const cwd = createRepository({ 'events/sub/a.schema.json': PUBLISHED });
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});

test('xoá hợp đồng chính thức được liệt kê, không bị chặn', () => {
  const cwd = createRepository({ 'events/sub/a.schema.json': PUBLISHED });
  rmSync(join(cwd, 'events/sub/a.schema.json'));
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.stdout.includes('changed: events/sub/a.schema.json: the file was removed'),
    result.stdout,
  );
});

test('hợp đồng dữ liệu thế giới trong thư mục world cũng được kiểm', () => {
  const cwd = createRepository({
    'world/shop.schema.json': JSON.stringify({ title: 'Shop', type: 'object' }),
  });
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /world\/shop\.schema\.json: missing \$id/);
});

test('xoá tệp cuối cùng của thư mục không làm công cụ hỏng', () => {
  const cwd = createRepository({ 'realtime/d.schema.json': DRAFT });
  rmSync(join(cwd, 'realtime'), { recursive: true });
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});

const WITH_FIELD = JSON.stringify({
  $id: 'https://x.test/a',
  title: 'A',
  type: 'object',
  properties: { name: { type: 'string' } },
});

function move(cwd, from, to, content) {
  rmSync(join(cwd, from));
  mkdirSync(dirname(join(cwd, to)), { recursive: true });
  writeFileSync(join(cwd, to), content);
}

test('dời hợp đồng chính thức vào thư mục phiên bản mà không đổi nội dung thì qua', () => {
  const cwd = createRepository({ 'events/a.v1.schema.json': WITH_FIELD });
  move(cwd, 'events/a.v1.schema.json', 'events/v1/a.schema.json', WITH_FIELD);
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});

test('dời vào thư mục phiên bản kèm xoá trường thì thay đổi được liệt kê, không bị chặn', () => {
  const cwd = createRepository({ 'events/a.v1.schema.json': WITH_FIELD });
  move(cwd, 'events/a.v1.schema.json', 'events/v1/a.schema.json', PUBLISHED);
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('changed: events/v1/a.schema.json'), result.stdout);
  assert.ok(result.stdout.includes('property "name" was removed'), result.stdout);
});

test('dời sang thư mục của phiên bản khác được liệt kê là xoá tệp cũ', () => {
  const cwd = createRepository({ 'events/a.v1.schema.json': WITH_FIELD });
  move(cwd, 'events/a.v1.schema.json', 'events/v2/a.schema.json', WITH_FIELD);
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.stdout.includes('changed: events/a.v1.schema.json: the file was removed'),
    result.stdout,
  );
});

const PROTO_FILE = 'grpc/v1/notification.proto';
const proto = (...lines) =>
  ['syntax = "proto3";', 'package netverse.notification.v1;', ...lines, ''].join('\n');
const SERVICE = 'service NotificationCommands { rpc Send (SendRequest) returns (SendReply); }';
const SEND = proto(
  SERVICE,
  'message SendRequest { string scope = 1; string event_type = 2; }',
  'message SendReply { string notification_id = 1; }',
);

test('hợp đồng gRPC hợp lệ thì qua', () => {
  const cwd = createRepository({ [PROTO_FILE]: SEND });
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
});

test('tệp proto sai cú pháp bị báo lỗi kèm tên tệp', () => {
  const cwd = createRepository({ [PROTO_FILE]: 'message {' });
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(PROTO_FILE), result.stderr);
});

test('package của proto phải khớp tên tệp và phiên bản', () => {
  const cwd = createRepository({
    [PROTO_FILE]: SEND.replace('netverse.notification.v1', 'other.v1'),
  });
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('package must be netverse.notification.v1'), result.stderr);
});

test('tên message, field và rpc sai quy ước bị báo lỗi', () => {
  const cwd = createRepository({
    [PROTO_FILE]: proto(
      'service NotificationCommands { rpc send (sendRequest) returns (SendReply); }',
      'message sendRequest { string eventType = 1; }',
      'message SendReply { }',
    ),
  });
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.ok(
    result.stderr.includes('message sendRequest is not named in PascalCase'),
    result.stderr,
  );
  assert.ok(result.stderr.includes('field sendRequest.eventType is not named in snake_case'));
  assert.ok(result.stderr.includes('rpc NotificationCommands.send is not named in PascalCase'));
});

test('thêm field, xoá field, đổi kiểu field trong proto đều được liệt kê, không bị chặn', () => {
  const cwd = createRepository({ [PROTO_FILE]: SEND });
  writeFileSync(
    join(cwd, PROTO_FILE),
    proto(
      SERVICE,
      'message SendRequest { string scope = 1; int32 event_type = 2; string locale = 3; }',
      'message SendReply { }',
    ),
  );
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('SendRequest.locale was added'), result.stdout);
  assert.ok(result.stdout.includes('SendRequest.event_type changed type'), result.stdout);
  assert.ok(result.stdout.includes('SendReply.notification_id was removed'), result.stdout);
});

test('dùng lại số của field đã xoá cho một field khác kiểu thì bị báo lỗi', () => {
  const cwd = createRepository({ [PROTO_FILE]: SEND });
  writeFileSync(
    join(cwd, PROTO_FILE),
    SEND.replace('string event_type = 2;', 'int64 retry_after = 2;'),
  );
  const result = check(cwd);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('SendRequest reuses field number 2'), result.stderr);
});

test('đổi tên field mà giữ số và kiểu thì được liệt kê, không bị chặn', () => {
  const cwd = createRepository({ [PROTO_FILE]: SEND });
  writeFileSync(
    join(cwd, PROTO_FILE),
    SEND.replace('string event_type = 2;', 'string event_name = 2;'),
  );
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.stdout.includes('SendRequest.event_type was renamed to event_name'),
    result.stdout,
  );
});

test('đổi enum và đổi field thường thành map trong proto được liệt kê', () => {
  const withEnum = proto(
    SERVICE,
    'enum Channel { CHANNEL_UNSPECIFIED = 0; CHANNEL_EMAIL = 1; CHANNEL_PUSH = 2; }',
    'message SendRequest { string scope = 1; string labels = 2; }',
    'message SendReply { string notification_id = 1; }',
  );
  const cwd = createRepository({ [PROTO_FILE]: withEnum });
  writeFileSync(
    join(cwd, PROTO_FILE),
    withEnum
      .replace('CHANNEL_PUSH = 2;', 'CHANNEL_IN_APP = 2;')
      .replace('string labels = 2;', 'map<string, string> labels = 2;'),
  );
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('enum value Channel.CHANNEL_PUSH was removed'), result.stdout);
  assert.ok(result.stdout.includes('enum value Channel.CHANNEL_IN_APP was added'), result.stdout);
  assert.ok(result.stdout.includes('SendRequest.labels changed type'), result.stdout);
});

test('bản cũ của proto không đọc được thì được ghi nhận, bước kiểm không sập', () => {
  const cwd = createRepository({ [PROTO_FILE]: 'message {' });
  writeFileSync(join(cwd, PROTO_FILE), SEND);
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('the previous version could not be read'), result.stdout);
});

test('thêm và xoá rpc được liệt kê', () => {
  const cwd = createRepository({ [PROTO_FILE]: SEND });
  writeFileSync(join(cwd, PROTO_FILE), SEND.replace('rpc Send (', 'rpc Dispatch ('));
  const result = check(cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('rpc NotificationCommands.Send was removed'), result.stdout);
  assert.ok(result.stdout.includes('rpc NotificationCommands.Dispatch was added'), result.stdout);
});
