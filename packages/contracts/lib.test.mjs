import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findOpenApiBreakingChanges,
  findSchemaBreakingChanges,
  isDraft,
  validateJsonSchema,
  validateOpenApi,
} from './lib.mjs';

const schema = {
  $id: 'https://netverse3d.test/a.json',
  title: 'A',
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' }, name: { type: 'string' } },
};

test('từ chối schema thiếu $id và title', () => {
  const errors = validateJsonSchema({ type: 'object' }, 'a').join();
  assert.match(errors, /missing \$id/);
  assert.match(errors, /missing title/);
});

test('từ chối schema có kiểu không hợp lệ', () => {
  assert.notEqual(validateJsonSchema({ ...schema, type: 'objekt' }, 'a').length, 0);
});

test('nhận schema hợp lệ', () => {
  assert.deepEqual(validateJsonSchema(schema, 'a'), []);
});

test('từ chối OpenAPI sai phiên bản, thiếu path', () => {
  const errors = validateOpenApi({ openapi: '3.0.0', info: {} }, 'a').join();
  assert.match(errors, /OpenAPI 3\.1/);
  assert.match(errors, /info\.title/);
  assert.match(errors, /no paths/);
});

test('từ chối operation thiếu operationId và responses', () => {
  const document = {
    openapi: '3.1.0',
    info: { title: 'A', version: '1' },
    paths: { '/a': { get: {} } },
  };
  const errors = validateOpenApi(document, 'a').join();
  assert.match(errors, /no operationId/);
  assert.match(errors, /no responses/);
});

test('phát hiện xoá trường là thay đổi phá vỡ', () => {
  const next = { ...schema, properties: { id: { type: 'string' } } };
  assert.match(findSchemaBreakingChanges(schema, next).join(), /"name" was removed/);
});

test('phát hiện đổi kiểu là thay đổi phá vỡ', () => {
  const next = { ...schema, properties: { ...schema.properties, id: { type: 'number' } } };
  assert.match(findSchemaBreakingChanges(schema, next).join(), /#\/id: type changed/);
});

test('phát hiện trường mới bắt buộc là thay đổi phá vỡ', () => {
  const next = { ...schema, required: ['id', 'name'] };
  assert.match(findSchemaBreakingChanges(schema, next).join(), /"name" became required/);
});

test('thêm trường tuỳ chọn không phá vỡ', () => {
  const next = { ...schema, properties: { ...schema.properties, age: { type: 'number' } } };
  assert.deepEqual(findSchemaBreakingChanges(schema, next), []);
});

test('phát hiện xoá định nghĩa dùng chung là thay đổi phá vỡ', () => {
  const previous = { ...schema, $defs: { seat: { type: 'object' } } };
  assert.match(findSchemaBreakingChanges(previous, schema).join(), /"seat" was removed/);
});

test('phát hiện xoá endpoint là thay đổi phá vỡ', () => {
  const previous = { paths: { '/a': { get: {}, post: {} } } };
  const current = { paths: { '/a': { get: {} } } };
  assert.deepEqual(findOpenApiBreakingChanges(previous, current), ['POST /a was removed']);
});

test('phát hiện thu hẹp enum là thay đổi phá vỡ', () => {
  const previous = { type: 'string', enum: ['a', 'b'] };
  const next = { type: 'string', enum: ['a'] };
  assert.match(findSchemaBreakingChanges(previous, next).join(), /enum value "b" was removed/);
  assert.deepEqual(findSchemaBreakingChanges(next, previous), []);
});

test('phát hiện đổi kiểu phần tử của mảng là thay đổi phá vỡ', () => {
  const previous = { type: 'array', items: { type: 'string' } };
  const next = { type: 'array', items: { type: 'number' } };
  assert.match(findSchemaBreakingChanges(previous, next).join(), /#\/items: type changed/);
});

test('phát hiện cấm trường lạ là thay đổi phá vỡ', () => {
  const previous = { type: 'object' };
  const next = { type: 'object', additionalProperties: false };
  assert.match(findSchemaBreakingChanges(previous, next).join(), /additionalProperties/);
});

test('phát hiện xoá lựa chọn trong oneOf là thay đổi phá vỡ', () => {
  const previous = { oneOf: [{ type: 'string' }, { type: 'number' }] };
  const next = { oneOf: [{ type: 'string' }] };
  assert.match(findSchemaBreakingChanges(previous, next).join(), /oneOf/);
});

test('phát hiện xoá mã phản hồi là thay đổi phá vỡ', () => {
  const previous = { paths: { '/a': { get: { responses: { 200: {}, 404: {} } } } } };
  const current = { paths: { '/a': { get: { responses: { 200: {} } } } } };
  assert.deepEqual(findOpenApiBreakingChanges(previous, current), ['GET /a no longer returns 404']);
});

test('nhận biết hợp đồng còn là nháp', () => {
  assert.equal(isDraft({ 'x-status': 'draft' }), true);
  assert.equal(isDraft({ info: { 'x-status': 'draft' } }), true);
  assert.equal(isDraft({}), false);
});
