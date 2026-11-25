import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fontRoot = dirname(
  createRequire(import.meta.url).resolve('@fontsource/be-vietnam-pro/package.json'),
);
const PAGE_FILES = [
  'components.mjs',
  'dom.mjs',
  'icons.mjs',
  'library.css',
  'main.mjs',
  'sections.mjs',
  'text.json',
];
const TOKEN_FILES = ['primitive.css', 'semantic.css', 'motion.css'];
const BROWSER_MODULES = ['accent.mjs', 'catalog.mjs', 'contrast.mjs', 'registry.mjs'];
const FONT_SUBSETS = ['vietnamese', 'latin'];
const FONT_WEIGHTS = [400, 600, 700];
const FONT_FORMATS = ['woff2', 'woff'];

function fontFaces() {
  return FONT_SUBSETS.flatMap((subset) =>
    FONT_WEIGHTS.map((weight) => readFileSync(join(fontRoot, `${subset}-${weight}.css`), 'utf8')),
  ).join('\n');
}

export function libraryEntries() {
  const fontFiles = FONT_SUBSETS.flatMap((subset) =>
    FONT_WEIGHTS.flatMap((weight) =>
      FONT_FORMATS.map((format) => `be-vietnam-pro-${subset}-${weight}-normal.${format}`),
    ),
  );
  return [
    { to: 'index.html', from: join(root, 'library', 'index.html') },
    ...PAGE_FILES.map((file) => ({ to: `library/${file}`, from: join(root, 'library', file) })),
    ...TOKEN_FILES.map((file) => ({ to: `tokens/${file}`, from: join(root, 'tokens', file) })),
    { to: 'components/components.css', from: join(root, 'components', 'components.css') },
    { to: 'components/registry.json', from: join(root, 'components', 'registry.json') },
    { to: 'library/media/shop.jpg', from: join(root, 'library', 'media', 'shop.jpg') },
    ...BROWSER_MODULES.map((file) => ({ to: `src/${file}`, from: join(root, 'src', file) })),
    ...fontFiles.map((file) => ({
      to: `fonts/files/${file}`,
      from: join(fontRoot, 'files', file),
    })),
    { to: 'fonts/LICENSE', from: join(fontRoot, 'LICENSE') },
    { to: 'fonts/fonts.css', content: fontFaces },
  ];
}

export function readEntry(entry) {
  return entry.content ? Buffer.from(entry.content()) : readFileSync(entry.from);
}

export function copyLibrary(target) {
  for (const entry of libraryEntries()) {
    const destination = join(target, entry.to);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, readEntry(entry));
  }
}
