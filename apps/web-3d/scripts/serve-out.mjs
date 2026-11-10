import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../out');
const PORT = Number(process.env.PORT ?? 4300);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

if (!existsSync(join(OUT, 'index.html'))) {
  console.error('No static export yet: run pnpm --filter @netverse/web-3d build first.');
  process.exit(1);
}

function fileFor(url) {
  const clean = decodeURIComponent(url.split('?')[0]);
  const direct = resolve(join(OUT, clean));
  if (!direct.startsWith(OUT)) return null;
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const page = clean.endsWith('/') ? join(direct, 'index.html') : `${direct}.html`;
  return existsSync(page) ? page : null;
}

createServer((request, response) => {
  const file = fileFor(request.url);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(PORT, '127.0.0.1', () => console.log(`web-3d preview: http://localhost:${PORT}/`));
