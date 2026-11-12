import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadDependencies } from '../catalog/graph.mjs';
import { loadCatalog } from '../catalog/lib.mjs';
import { changedFiles, tagExists } from './git-facts.mjs';
import { contentPaths, tagFor } from './lib.mjs';

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
  return {
    peer,
    peerExists,
    sameContent: peerExists && changedFiles(peer, ref, cwd, paths).length === 0,
  };
}
