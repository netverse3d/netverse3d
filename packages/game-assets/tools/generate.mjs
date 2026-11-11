import { existsSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildShowcasePlan } from '../pipeline/showcase_plan.mjs';
import { runBlender } from './blender.mjs';
import { loadConfig } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(root);
const wanted = new Set(process.argv.slice(2));

export function generatorTargets(config) {
  const kits = config.kits.map((kit) => ({
    kind: 'kit',
    name: basename(kit.source, '.blend'),
    source: kit.source,
    generator: kit.generator,
  }));
  const scenes = (config.scenes ?? []).map((scene) => ({
    kind: 'scene',
    name: scene.id,
    source: scene.source,
    recipe: scene.recipe,
    kits: scene.kits,
    generator: scene.generator,
  }));
  return [...kits, ...scenes];
}

function selected(target) {
  return wanted.size === 0 || wanted.has(target.name) || wanted.has(target.source);
}

function argumentsFor(target) {
  const output = join(root, 'source', target.source);
  if (target.kind === 'kit') return [output];
  const plan = join(root, 'pipeline', 'showcase-plan.json');
  writeFileSync(plan, JSON.stringify(buildShowcasePlan(root, target.recipe), null, 2));
  const kitSources = (target.kits ?? []).map((file) => {
    const kit = config.kits.find((entry) => entry.file === file);
    if (!kit) throw new Error(`${target.source}: scene uses unknown kit ${file}`);
    return join(root, 'source', kit.source);
  });
  return [plan, ...kitSources, output];
}

let failed = false;
for (const target of generatorTargets(config).filter(selected)) {
  if (!target.generator) {
    console.log(`${target.source}: hand-made in Blender, nothing to generate`);
    continue;
  }
  const script = join(root, target.generator);
  if (!existsSync(script)) {
    console.error(`${target.source}: generator ${target.generator} is missing`);
    failed = true;
    continue;
  }
  console.log(`${target.source}: running ${target.generator}`);
  const status = runBlender(script, argumentsFor(target));
  if (status !== 0) {
    console.error(`${target.source}: generator exited with ${status}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('Generated. Run the export to refresh the GLB files.');
