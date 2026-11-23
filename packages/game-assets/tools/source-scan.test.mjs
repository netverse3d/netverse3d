import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { listSourceFiles, scanSources } from './source-scan.mjs';

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'source-scan-'));
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

function slash(path) {
  return path.replaceAll('\\', '/');
}

test('duyệt có chọn lọc phần mở rộng, thư mục con và đường dẫn bị bỏ qua', () => {
  const root = fixture({
    'src/z.ts': 'export const z = true;',
    'src/a.html': '<main></main>',
    'src/data.json': '{}',
    'src/ignored/skip.ts': 'export const skip = true;',
    'src/ignored.test.ts': 'export const test = true;',
  });
  try {
    const files = listSourceFiles([root], {
      extensions: ['.ts', '.html'],
      skip: [/\/ignored\.test\.ts$/],
    });
    assert.deepEqual(files, [
      slash(join(root, 'src/a.html')),
      slash(join(root, 'src/ignored/skip.ts')),
      slash(join(root, 'src/z.ts')),
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('duyệt một thư mục không đệ quy khi root yêu cầu', () => {
  const root = fixture({
    'runtime/a.mjs': 'export const a = true;',
    'runtime/nested/b.mjs': 'export const b = true;',
  });
  try {
    const files = listSourceFiles([{ path: join(root, 'runtime'), recursive: false }], {
      extensions: ['.mjs'],
    });
    assert.deepEqual(files, [slash(join(root, 'runtime/a.mjs'))]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('trả đúng tệp, dòng, luật và đoạn khớp', () => {
  const root = fixture({
    'scene.mjs': ['const scene = {};', 'new THREE.PointLight(0xffffff, 1);'].join('\n'),
  });
  try {
    const file = slash(join(root, 'scene.mjs'));
    assert.deepEqual(
      scanSources([file], [{ rule: 'lighting', pattern: /new\s+THREE\.PointLight\s*\(/ }]),
      [
        {
          file,
          line: 2,
          rule: 'lighting',
          match: 'new THREE.PointLight(',
        },
      ],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('allowlist chỉ bỏ đúng cặp tệp và luật có lý do', () => {
  const root = fixture({
    'studio.html': 'new THREE.PointLight();\nscene.fog = null;',
  });
  try {
    const file = slash(join(root, 'studio.html'));
    assert.deepEqual(
      scanSources(
        [file],
        [
          { rule: 'lighting', pattern: /new\s+THREE\.PointLight\s*\(/ },
          { rule: 'scene-state', pattern: /scene\.fog\s*=/ },
        ],
        [{ file, rule: 'lighting', reason: 'legacy scene' }],
      ),
      [{ file, line: 2, rule: 'scene-state', match: 'scene.fog =' }],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('quét được luật có mẫu nhiều dòng và giữ dòng bắt đầu', () => {
  const root = fixture({
    'scene.mjs': 'const pass = new UnrealBloomPass(\n  new Vector2(0, 0),\n  0.2,\n);',
  });
  try {
    const file = slash(join(root, 'scene.mjs'));
    const [match] = scanSources(
      [file],
      [{ rule: 'lighting', pattern: /new\s+UnrealBloomPass\s*\([\s\S]{0,100}?\b0\.2\b/ }],
    );
    assert.equal(match.file, file);
    assert.equal(match.line, 1);
    assert.equal(match.rule, 'lighting');
    assert.match(match.match, /new UnrealBloomPass/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
