import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(app, '../../packages/game-assets');
const target = join(app, 'public/game-assets');

const LFS_HEAD = 'version https://git-lfs';

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, 'exported'), { recursive: true });
const pointers = [];
for (const file of readdirSync(join(source, 'exported')).filter((name) => name.endsWith('.glb'))) {
  const path = join(source, 'exported', file);
  if (readFileSync(path, { encoding: 'utf8', flag: 'r' }).startsWith(LFS_HEAD)) pointers.push(file);
  cpSync(path, join(target, 'exported', file));
}
if (pointers.length > 0) {
  console.warn(
    `These models are LFS pointers, run git lfs pull to see them: ${pointers.join(', ')}`,
  );
}
cpSync(join(source, 'recipes'), join(target, 'recipes'), { recursive: true });
cpSync(join(source, 'assets.config.json'), join(target, 'assets.config.json'));
console.log(`Synced game assets into ${target}`);
