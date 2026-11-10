import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { hasGlbHeader, loadConfig, outputFiles } from './lib.mjs';

const SERVED_FOLDERS = new Set(['library', 'exported', 'runtime', 'recipes']);
const MODEL_FOLDERS = ['exported', 'library/models'];
const PILOT_MODELS = ['library/models/bot-d1.glb', 'library/models/human-hoodie.glb'];
const RUNTIME_FOLDER = 'runtime';
const RECIPE_FOLDER = 'recipes';
const TEST_SUFFIX = '.test.mjs';
const CONFIG_FILE = 'assets.config.json';
const KEYBOARDS_FILE = 'keyboards.json';
const ROOT_FILES = new Set([CONFIG_FILE, KEYBOARDS_FILE]);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

export function resolveRequestPath(root, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\\')) return null;
  const target = resolve(root, `.${pathname}`);
  const inside = relative(root, target);
  if (inside.startsWith('..') || isAbsolute(inside)) return null;
  if (!ROOT_FILES.has(inside) && !SERVED_FOLDERS.has(inside.split(sep)[0])) return null;
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

function requiredModels(root) {
  const exported = outputFiles(loadConfig(root)).map((file) => `exported/${file}`);
  return [...exported, ...PILOT_MODELS];
}

export function findUnusableModels(root) {
  return requiredModels(root).filter((file) => {
    const path = join(root, file);
    return !existsSync(path) || (file.endsWith('.glb') && !hasGlbHeader(readFileSync(path)));
  });
}

export function copyLibrary(root, target) {
  const unusable = findUnusableModels(root);
  if (unusable.length > 0) return unusable;
  mkdirSync(join(target, 'exported'), { recursive: true });
  cpSync(join(root, 'library'), join(target, 'library'), { recursive: true });
  for (const file of listModels(root, 'exported')) {
    copyFileSync(join(root, file), join(target, file));
  }
  cpSync(join(root, RUNTIME_FOLDER), join(target, RUNTIME_FOLDER), {
    recursive: true,
    filter: (source) => !source.endsWith(TEST_SUFFIX),
  });
  cpSync(join(root, RECIPE_FOLDER), join(target, RECIPE_FOLDER), { recursive: true });
  for (const file of ROOT_FILES) copyFileSync(join(root, file), join(target, file));
  return [];
}
