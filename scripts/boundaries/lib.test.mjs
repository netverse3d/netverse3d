import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { findViolations, importedModules } from './lib.mjs';
import { RULES } from './rules.mjs';

function repository(files) {
  const root = mkdtempSync(join(tmpdir(), 'boundaries-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function violationsIn(files, rules = RULES) {
  const root = repository(files);
  try {
    return findViolations(root, rules);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('đọc được mọi kiểu import trong một tệp', () => {
  const source = [
    "import React from 'react';",
    "import type { Scene } from 'three';",
    "import {\n  a,\n  b,\n} from './multi-line.ts';",
    "import './side-effect.css';",
    "export { c } from '../re-export.ts';",
    "export * from '@netverse/game-shared/movement';",
    "const lazy = await import('three/addons/loaders/GLTFLoader.js');",
    "const legacy = require('next/router');",
  ].join('\n');
  assert.deepEqual(importedModules(source), [
    'react',
    'three',
    './multi-line.ts',
    './side-effect.css',
    '../re-export.ts',
    '@netverse/game-shared/movement',
    'three/addons/loaders/GLTFLoader.js',
    'next/router',
  ]);
});

test('giữ đúng thứ tự xuất hiện khi import động đứng trước import tĩnh', () => {
  const source = "const early = await import('first');\nexport { late } from 'second';";
  assert.deepEqual(importedModules(source), ['first', 'second']);
});

test('tệp trong cùng thư mục trùng tên với gói bị cấm thì không bị báo', () => {
  const violations = violationsIn({
    'apps/web-3d/src/scene/shop.ts': "import { helper } from './react.ts';",
    'apps/web-3d/src/ui/hud.tsx': "import { helper } from './three/index.ts';",
  });
  assert.deepEqual(violations, []);
});

test('không coi chữ import nằm trong tên biến hay chuỗi thường là một lần import', () => {
  const source =
    "const reimport = 1;\nconst note = 'see the import list';\nfunction important() {}";
  assert.deepEqual(importedModules(source), []);
});

test('lớp cảnh 3D dùng React thì bị báo', () => {
  const violations = violationsIn({
    'apps/web-3d/src/scene/shop.ts': "import { useEffect } from 'react';",
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /apps\/web-3d\/src\/scene\/shop\.ts.*react/);
});

test('lớp giao diện dùng Three.js thì bị báo, kể cả qua đường dẫn con của gói', () => {
  const violations = violationsIn({
    'apps/web-3d/src/ui/hud.tsx': "import { Vector3 } from 'three';",
    'apps/web-3d/src/ui/loader.tsx':
      "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    'apps/web-3d/app/page.tsx': "import * as THREE from 'three';",
  });
  assert.equal(violations.length, 3);
});

test('gói có tên bắt đầu giống gói bị cấm thì không bị báo nhầm', () => {
  const violations = violationsIn({
    'apps/web-3d/src/ui/hud.tsx': "import { tree } from 'three-shaking-report';",
    'apps/web-3d/src/scene/shop.ts': "import { reactive } from 'reactive-values';",
  });
  assert.deepEqual(violations, []);
});

test('giao diện gọi thẳng vào cảnh, luật chơi hay kết nối thì bị báo; đi qua kho trạng thái thì được', () => {
  const violations = violationsIn({
    'apps/web-3d/src/ui/prompt.tsx': [
      "import { camera } from '../scene/camera.ts';",
      "import { sit } from '../game/seat.ts';",
      "import { socket } from '../net/socket.ts';",
      "import { readGame } from '../state/store.ts';",
    ].join('\n'),
  });
  assert.equal(violations.length, 3);
  assert.equal(
    violations.some((line) => line.includes('state/store')),
    false,
  );
});

test('import qua bí danh thư mục cũng bị bắt như đường dẫn tương đối', () => {
  const violations = violationsIn({
    'apps/web-3d/src/scene/shop.ts': "import { Hud } from '@/ui/hud.tsx';",
  });
  assert.equal(violations.length, 1);
});

test('luật chơi dùng chung không được dính Three.js, React hay mã của ứng dụng', () => {
  const violations = violationsIn({
    'packages/game-shared/src/movement.ts': "import { Vector3 } from 'three';",
    'packages/game-shared/src/room.ts':
      "import { hud } from '../../../apps/web-3d/src/ui/hud.tsx';",
    'packages/game-shared/src/hook.ts': "import { useState } from 'react';",
  });
  assert.equal(violations.length, 3);
});

test('trang ở tầng ghép nối được gọi cả cảnh lẫn giao diện', () => {
  const violations = violationsIn({
    'apps/web-3d/app/play/page.tsx': [
      "import { mountShop } from '../../src/scene/shop.ts';",
      "import { Hud } from '../../src/ui/hud.tsx';",
      "import { useState } from 'react';",
    ].join('\n'),
  });
  assert.deepEqual(violations, []);
});

test('thư mục node_modules và thư mục build không bị quét', () => {
  const violations = violationsIn({
    'apps/web-3d/src/ui/node_modules/lib/index.js': "import 'three';",
    'apps/web-3d/src/ui/dist/bundle.js': "import 'three';",
    'apps/web-3d/app/.next/chunk.js': "import 'three';",
  });
  assert.deepEqual(violations, []);
});

test('lớp chưa có thư mục thì coi như sạch', () => {
  assert.deepEqual(violationsIn({ 'README.md': '# empty' }), []);
});

test('mỗi vi phạm nói rõ tệp, thứ bị import và lý do', () => {
  const [violation] = violationsIn({ 'src/low/a.ts': "import { b } from '../high/b.ts';" }, [
    { layer: 'src/low', forbidden: [{ paths: ['src/high'], reason: 'low stays below high' }] },
  ]);
  assert.equal(violation, "src/low/a.ts imports '../high/b.ts': low stays below high");
});
