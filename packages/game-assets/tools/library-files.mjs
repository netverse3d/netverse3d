import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isLfsPointer } from './lib.mjs';

const SERVED_FOLDERS = new Set(['library', 'exported']);
const MODEL_FOLDERS = ['exported', 'library/models'];
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.glb': 'model/gltf-binary',
};

export function resolveRequestPath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  const target = resolve(root, `.${pathname}`);
  const inside = relative(root, target);
  if (inside.startsWith('..') || isAbsolute(inside)) return null;
  if (!SERVED_FOLDERS.has(inside.split(sep)[0])) return null;
  return inside === 'library' ? join(target, 'index.html') : target;
}

export function contentTypeOf(file) {
  return CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
}

function listModels(root, folder) {
  return readdirSync(join(root, folder))
    .filter((file) => file.endsWith('.glb'))
    .map((file) => `${folder}/${file}`);
}

export function listLibraryModels(root) {
  return MODEL_FOLDERS.flatMap((folder) => listModels(root, folder));
}

export function findPointers(root) {
  return listLibraryModels(root).filter((file) => isLfsPointer(readFileSync(join(root, file))));
}

export function copyLibrary(root, target) {
  const pointers = findPointers(root);
  if (pointers.length > 0) return pointers;
  mkdirSync(join(target, 'exported'), { recursive: true });
  cpSync(join(root, 'library'), join(target, 'library'), { recursive: true });
  for (const file of listModels(root, 'exported')) {
    copyFileSync(join(root, file), join(target, file));
  }
  return [];
}
