import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));

const ENTRY = `
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMOS, initialValues } from './library/demos.tsx';
import text from './library/text.json';
export const DEMO_IDS = Object.keys(DEMOS);
export function renderDemo(registry, entry) {
  return renderToStaticMarkup(
    createElement(DEMOS[entry.demo], { text: text.components, values: initialValues(registry, entry) }),
  );
}
`;

export async function loadDemos() {
  const cache = join(root, 'node_modules', '.cache');
  mkdirSync(cache, { recursive: true });
  const folder = mkdtempSync(join(cache, 'library-demos-'));
  try {
    await build({
      stdin: { contents: ENTRY, resolveDir: root, loader: 'tsx', sourcefile: 'demos-entry.tsx' },
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      jsx: 'automatic',
      outfile: join(folder, 'demos.mjs'),
      loader: { '.jpg': 'file' },
      logLevel: 'silent',
    });
    return await import(pathToFileURL(join(folder, 'demos.mjs')).href);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
