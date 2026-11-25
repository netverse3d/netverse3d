import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { libraryEntries, readEntry } from './library-files.mjs';

const PORT = Number(process.env.PORT ?? 4174);
const LIBRARY_PREFIX = '/ui/';
const RECIPES_PREFIX = '/game-assets/recipes/';
const recipes = fileURLToPath(new URL('../../game-assets/recipes/', import.meta.url));
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
};

function find(pathname) {
  if (pathname.startsWith(RECIPES_PREFIX)) {
    const name = normalize(pathname.slice(RECIPES_PREFIX.length));
    if (!/^[\w-]+\.json$/.test(name)) return null;
    return { type: '.json', body: () => readFileSync(join(recipes, name)) };
  }
  if (!pathname.startsWith(LIBRARY_PREFIX)) return null;
  const relative = pathname.slice(LIBRARY_PREFIX.length) || 'index.html';
  const entry = libraryEntries().find((item) => item.to === relative);
  return entry ? { type: extname(entry.to), body: () => readEntry(entry) } : null;
}

createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/') {
    response.writeHead(302, { location: LIBRARY_PREFIX }).end();
    return;
  }
  const found = find(pathname);
  if (!found) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = found.body();
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[found.type] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(PORT, () =>
  console.log(`Interface library at http://localhost:${PORT}${LIBRARY_PREFIX}`),
);
