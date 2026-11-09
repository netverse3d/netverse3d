import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentTypeOf, findPointers, resolveRequestPath } from './library-files.mjs';

const DEFAULT_PORT = 4173;
const HOST = '127.0.0.1';
const LIBRARY_ROUTE = '/library/';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? DEFAULT_PORT);

const pointers = findPointers(root);
if (pointers.length > 0) {
  console.error(`These models are not downloaded yet: ${pointers.join(', ')}`);
  console.error('Run git lfs pull, then try again.');
  process.exit(1);
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const server = createServer((request, response) => {
  const pathname = request.url.split('?')[0];
  if (pathname === '/' || pathname === '/library') {
    response.writeHead(302, { Location: LIBRARY_ROUTE }).end();
    return;
  }
  const file = resolveRequestPath(root, request.url);
  if (!file || !isFile(file)) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': contentTypeOf(file) });
  createReadStream(file).pipe(response);
});

server.listen(port, HOST, () => {
  console.log(`3D library: http://localhost:${port}${LIBRARY_ROUTE}`);
});
