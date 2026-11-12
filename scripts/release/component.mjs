import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadDependencies } from '../catalog/graph.mjs';
import { loadCatalog } from '../catalog/lib.mjs';
import { gitOutputOrNull } from '../lib/git.mjs';
import { changedFiles, tagExists } from './git-facts.mjs';
import { contentPaths, tagFor } from './lib.mjs';

function catalogAt(cwd, ref) {
  const text = gitOutputOrNull(['show', `${ref}:docs/catalog.yaml`], cwd);
  return text === null ? [] : (parse(text)?.components ?? []);
}

function pathsDeclaredAt(cwd, ref, id) {
  const catalog = catalogAt(cwd, ref);
  const pathById = new Map(catalog.map((component) => [component.id, component.path]));
  const declared = catalog.find((component) => component.id === id)?.depends_on;
  return (Array.isArray(declared) ? declared : []).map((needed) => pathById.get(needed));
}

export function describeComponent(cwd, id) {
  const catalog = loadCatalog(cwd);
  const entry = catalog.find((component) => component.id === id);
  const deployable = Boolean(entry) && existsSync(join(cwd, entry.path, 'Dockerfile'));
  return {
    entry,
    deployable,
    paths: deployable ? contentPaths(entry, catalog, loadDependencies(cwd, catalog)) : [],
  };
}

export function comparePeer(cwd, id, version, ref, paths) {
  const peer = tagFor(id, 'staging', version);
  const peerExists = tagExists(peer, cwd);
  if (!peerExists) return { peer, peerExists, sameContent: false };
  const compared = [...new Set([...paths, ...pathsDeclaredAt(cwd, peer, id)])].filter(Boolean);
  return {
    peer,
    peerExists,
    sameContent: changedFiles(peer, ref, cwd, compared).length === 0,
  };
}
