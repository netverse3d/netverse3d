import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchLibrary } from './library-files.mjs';

const PORT = Number(process.env.PORT ?? 4174);
const LIBRARY_PREFIX = '/ui/';
const RECIPES_PREFIX = '/game-assets/recipes/';
const recipes = fileURLToPath(new URL('../../game-assets/recipes/', import.meta.url));
const output = mkdtempSync(join(tmpdir(), 'netverse-ui-library-'));
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.jpg': 'image/jpeg',
};

function resolveFile(pathname) {
  const [prefix, folder] = pathname.startsWith(RECIPES_PREFIX)
    ? [RECIPES_PREFIX, recipes]
    : pathname.startsWith(LIBRARY_PREFIX)
      ? [LIBRARY_PREFIX, output]
      : [null, null];
  if (!prefix) return null;
  const relative = normalize(pathname.slice(prefix.length) || 'index.html');
  if (relative.startsWith('..')) return null;
  return join(folder, relative);
}

const watcher = await watchLibrary(output);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/') {
    response.writeHead(302, { location: LIBRARY_PREFIX }).end();
    return;
  }
  const file = resolveFile(pathname);
  try {
    if (!file) throw new Error('not found');
    const body = readFileSync(file);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(PORT, () =>
  console.log(`Interface library at http://localhost:${PORT}${LIBRARY_PREFIX}`),
);

process.on('SIGINT', async () => {
  server.close();
  await watcher.dispose();
  rmSync(output, { recursive: true, force: true });
  process.exit(0);
});
