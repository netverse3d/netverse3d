import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const fontRoot = dirname(
  createRequire(import.meta.url).resolve('@fontsource/be-vietnam-pro/package.json'),
);

function bundleOptions(
  target,
  { production, entryPoints = { library: join(root, 'library', 'main.tsx') } },
) {
  return {
    entryPoints,
    bundle: true,
    format: 'esm',
    target: 'es2022',
    outdir: target,
    entryNames: '[name]',
    assetNames: 'assets/[name]-[hash]',
    loader: { '.woff2': 'file', '.woff': 'file', '.jpg': 'file' },
    jsx: 'automatic',
    minify: production,
    define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
    logLevel: 'warning',
  };
}

function copyStatic(target) {
  mkdirSync(join(target, 'fonts'), { recursive: true });
  copyFileSync(join(root, 'library', 'index.html'), join(target, 'index.html'));
  copyFileSync(join(fontRoot, 'LICENSE'), join(target, 'fonts', 'LICENSE'));
}

export async function buildPage(target, name, entry) {
  mkdirSync(target, { recursive: true });
  await build(bundleOptions(target, { production: true, entryPoints: { [name]: entry } }));
}

export async function buildLibrary(target) {
  mkdirSync(target, { recursive: true });
  await build(bundleOptions(target, { production: true }));
  copyStatic(target);
}

export async function watchLibrary(target) {
  mkdirSync(target, { recursive: true });
  copyStatic(target);
  const watcher = await context(bundleOptions(target, { production: false }));
  await watcher.rebuild();
  await watcher.watch();
  return watcher;
}
