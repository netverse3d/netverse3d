import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_HEADER_SIZE = 20;
const MAX_POINTER_SIZE = 1024;
const LFS_POINTER =
  /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize \d+\n$/;
const NUMBERED_COPY = /\.\d{3}$/;
const LOD_TOLERANCE = 1.02;
const STAMP_FILE = 'export-stamp.json';

export function loadConfig(root) {
  return JSON.parse(readFileSync(join(root, 'assets.config.json'), 'utf8'));
}

function matchPointer(buffer) {
  if (buffer.length > MAX_POINTER_SIZE) return null;
  return buffer.toString('utf8').match(LFS_POINTER);
}

export function isLfsPointer(buffer) {
  return matchPointer(buffer) !== null;
}

export function contentId(buffer) {
  return matchPointer(buffer)?.[1] ?? createHash('sha256').update(buffer).digest('hex');
}

export function readGlb(buffer) {
  if (buffer.length < GLB_HEADER_SIZE || buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('not a GLB file');
  }
  if (buffer.readUInt32LE(16) !== JSON_CHUNK_TYPE) throw new Error('GLB has no JSON chunk');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(GLB_HEADER_SIZE, GLB_HEADER_SIZE + length).toString('utf8'));
}

function triangleCount(gltf, mesh) {
  return mesh.primitives.reduce((total, primitive) => {
    const accessor = primitive.indices ?? primitive.attributes.POSITION;
    return total + gltf.accessors[accessor].count / 3;
  }, 0);
}

function compareNames(kind, actual, expected, fail) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  for (const name of expectedSet) if (!actualSet.has(name)) fail(`missing ${kind}: ${name}`);
  for (const name of actualSet) if (!expectedSet.has(name)) fail(`unexpected ${kind}: ${name}`);
}

function checkMeshes(gltf, nodes, expected, fail) {
  compareNames(
    'mesh',
    nodes.map((node) => node.name),
    Object.keys(expected.meshes),
    fail,
  );
  for (const node of nodes) {
    const limit = expected.meshes[node.name];
    if (limit === undefined) continue;
    const triangles = triangleCount(gltf, gltf.meshes[node.mesh]);
    if (triangles > limit) fail(`${node.name} has ${triangles} triangles, limit ${limit}`);
  }
}

function checkSkins(gltf, nodes, bones, fail) {
  for (const skin of gltf.skins ?? []) {
    compareNames(
      'bone',
      skin.joints.map((joint) => gltf.nodes[joint].name),
      bones,
      fail,
    );
  }
  for (const node of nodes) {
    if (node.skin === undefined) {
      fail(`${node.name} is not skinned`);
      continue;
    }
    const weighted = gltf.meshes[node.mesh].primitives.every(
      (primitive) =>
        primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined,
    );
    if (!weighted) fail(`${node.name} has no skin weights`);
  }
}

function checkClips(gltf, clips, fail) {
  const animations = gltf.animations ?? [];
  compareNames(
    'clip',
    animations.map((animation) => animation.name),
    clips,
    fail,
  );
  for (const animation of animations) {
    if (animation.channels.length === 0) fail(`clip ${animation.name} has no channels`);
  }
}

function checkAttributes(gltf, nodes, required, fail) {
  for (const node of nodes) {
    for (const attribute of required[node.name] ?? []) {
      const present = gltf.meshes[node.mesh].primitives.every(
        (primitive) => primitive.attributes[attribute] !== undefined,
      );
      if (!present) fail(`${node.name} is missing attribute ${attribute}`);
    }
  }
}

export function checkModel(file, gltf, expected) {
  const errors = [];
  const fail = (message) => errors.push(`${file}: ${message}`);
  const meshNodes = (gltf.nodes ?? []).filter((node) => node.mesh !== undefined);
  checkMeshes(gltf, meshNodes, expected, fail);
  for (const material of gltf.materials ?? []) {
    if (NUMBERED_COPY.test(material.name)) fail(`duplicated material: ${material.name}`);
  }
  if (expected.bones) checkSkins(gltf, meshNodes, expected.bones, fail);
  checkClips(gltf, expected.clips ?? [], fail);
  checkAttributes(gltf, meshNodes, expected.attributes ?? {}, fail);
  return errors;
}

export function sourceFiles(config) {
  const { character, props } = config;
  return [
    ...new Set([
      character.rigSource,
      character.clipSource,
      ...Object.values(character.meshes).map((mesh) => mesh.source),
      ...props.map((prop) => prop.source),
    ]),
  ];
}

export function outputFiles(config) {
  return [
    config.character.file,
    config.character.lodFile,
    ...config.props.map((prop) => prop.file),
  ];
}

function expectations(config) {
  const { bones, clips, character, props } = config;
  const limits = (pick) =>
    Object.fromEntries(Object.entries(character.meshes).map(([name, mesh]) => [name, pick(mesh)]));
  const attributes = limits((mesh) => mesh.requiredAttributes ?? []);
  return [
    { file: character.file, bones, clips, attributes, meshes: limits((mesh) => mesh.maxTriangles) },
    {
      file: character.lodFile,
      bones,
      clips: [],
      attributes,
      meshes: limits((mesh) =>
        mesh.lodTriangles ? Math.ceil(mesh.lodTriangles * LOD_TOLERANCE) : mesh.maxTriangles,
      ),
    },
    ...props.map((prop) => ({ file: prop.file, meshes: { [prop.object]: prop.maxTriangles } })),
  ];
}

function hashFiles(folder, files) {
  return Object.fromEntries(
    files.map((file) => [file, contentId(readFileSync(join(folder, file)))]),
  );
}

export function buildStamp(root, config) {
  return {
    sources: hashFiles(join(root, 'source'), sourceFiles(config)),
    exported: hashFiles(join(root, 'exported'), outputFiles(config)),
  };
}

function compareHashes(folder, recorded, describe) {
  const errors = [];
  for (const [file, hash] of Object.entries(recorded)) {
    const path = join(folder, file);
    if (!existsSync(path)) errors.push(`${file} is missing`);
    else if (contentId(readFileSync(path)) !== hash) errors.push(describe(file));
  }
  return errors;
}

function listUnstamped(declared, recorded) {
  return declared
    .filter((file) => recorded[file] === undefined)
    .map((file) => `${file} is not in the export stamp: run the export`);
}

export function stampPath(root) {
  return join(root, 'exported', STAMP_FILE);
}

export function checkStamp(root, config) {
  if (!existsSync(stampPath(root))) return [`${STAMP_FILE} is missing: run the export`];
  const stamp = JSON.parse(readFileSync(stampPath(root), 'utf8'));
  const declared = new Set(sourceFiles(config));
  const undeclared = readdirSync(join(root, 'source'))
    .filter((file) => file.endsWith('.blend') && !declared.has(file))
    .map((file) => `${file} is not declared in assets.config.json`);
  return [
    ...undeclared,
    ...listUnstamped(sourceFiles(config), stamp.sources),
    ...listUnstamped(outputFiles(config), stamp.exported),
    ...compareHashes(
      join(root, 'source'),
      stamp.sources,
      (file) => `${file} changed since the last export`,
    ),
    ...compareHashes(
      join(root, 'exported'),
      stamp.exported,
      (file) => `${file} does not match the last export`,
    ),
  ];
}

function checkContent(root, config, requireContent) {
  const errors = [];
  const skipped = [];
  for (const expected of expectations(config)) {
    const path = join(root, 'exported', expected.file);
    if (!existsSync(path)) {
      errors.push(`${expected.file} is missing`);
      continue;
    }
    const buffer = readFileSync(path);
    if (!isLfsPointer(buffer)) errors.push(...checkModel(expected.file, readGlb(buffer), expected));
    else if (requireContent) errors.push(`${expected.file} is an LFS pointer: fetch it first`);
    else skipped.push(expected.file);
  }
  return { errors, skipped };
}

export function checkAssets(root, { requireContent = false } = {}) {
  const config = loadConfig(root);
  const { errors, skipped } = checkContent(root, config, requireContent);
  return { errors: [...new Set([...checkStamp(root, config), ...errors])], skipped };
}

export function finishExport(root) {
  const config = loadConfig(root);
  const { errors } = checkContent(root, config, true);
  if (errors.length === 0) {
    writeFileSync(stampPath(root), `${JSON.stringify(buildStamp(root, config), null, 2)}\n`);
  }
  return errors;
}
