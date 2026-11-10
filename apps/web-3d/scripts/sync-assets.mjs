import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(app, '../../packages/game-assets');
const target = join(app, 'public/game-assets');

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, 'exported'), { recursive: true });
for (const file of readdirSync(join(source, 'exported')).filter((name) => name.endsWith('.glb'))) {
  cpSync(join(source, 'exported', file), join(target, 'exported', file));
}
cpSync(join(source, 'recipes'), join(target, 'recipes'), { recursive: true });
cpSync(join(source, 'assets.config.json'), join(target, 'assets.config.json'));
console.log(`Synced game assets into ${target}`);
