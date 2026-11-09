import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkStamp, isLfsPointer, loadConfig, outputFiles, sourceFiles } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('tệp xuất trong repo khớp với tệp gốc hiện tại', () => {
  assert.deepEqual(checkStamp(ROOT, loadConfig(ROOT)), []);
});

test('trên CI tệp gốc và tệp xuất phải được lưu bằng Git LFS', { skip: !process.env.CI }, () => {
  const config = loadConfig(ROOT);
  const files = [
    ...sourceFiles(config).map((file) => join('source', file)),
    ...outputFiles(config).map((file) => join('exported', file)),
  ];
  for (const file of files) {
    assert.equal(isLfsPointer(readFileSync(join(ROOT, file))), true, `${file} is not in Git LFS`);
  }
});
