import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out');
const FAKE_ROOM_SOURCE = join(ROOT, 'dev', 'fake-room.ts');
const MARKER = /const CLOSED_MESSAGE = '([^']+)';/;

function scripts(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return scripts(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

test('bản build không bật cờ phòng giả thì không chứa mã của room server giả', (t: TestContext) => {
  if (process.env.NEXT_PUBLIC_ROOM === 'fake') {
    t.skip('this build was made with the fake room on purpose');
    return;
  }
  assert.ok(existsSync(join(OUT, 'index.html')), 'run the build before this test');
  const marker = MARKER.exec(readFileSync(FAKE_ROOM_SOURCE, 'utf8'))?.[1];
  assert.ok(marker, 'the fake room no longer declares its closed message');
  const files = scripts(OUT);
  assert.ok(files.length > 0, 'the build has no scripts');
  const leaked = files.filter((file) => readFileSync(file, 'utf8').includes(marker));
  assert.deepEqual(leaked, []);
});
