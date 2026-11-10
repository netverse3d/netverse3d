import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkCoplanar, roomAssemblies } from './coplanar.mjs';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_HEADER_SIZE = 20;
const GLB_CHUNK_HEADER_SIZE = 8;
const UV_PAIR_SIZE = 8;
const PALETTE_ROW_TOLERANCE = 0.001;
const MAX_POINTER_SIZE = 1024;
const LFS_POINTER =
  /^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize \d+\n$/;
const NUMBERED_COPY = /\.\d{3}$/;
const LOD_TOLERANCE = 1.02;
const ANCHOR_SEPARATOR = '__';
const TRANSFORM_TOLERANCE = 1e-5;
const GRID_TOLERANCE = 0.005;
const IDENTITY_TRANSFORM = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const COLLISION_PREFIX = 'collision_';
const STAMP_FILE = 'export-stamp.json';
const CONFIG_FILE = 'assets.config.json';

export function loadConfig(root) {
  return JSON.parse(readFileSync(join(root, CONFIG_FILE), 'utf8'));
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

export function hasGlbHeader(buffer) {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === GLB_MAGIC;
}

export function readGlb(buffer) {
  if (buffer.length < GLB_HEADER_SIZE || buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('not a GLB file');
  }
  if (buffer.readUInt32LE(16) !== JSON_CHUNK_TYPE) throw new Error('GLB has no JSON chunk');
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(GLB_HEADER_SIZE, GLB_HEADER_SIZE + length).toString('utf8'));
}

export function readGlbBinary(buffer) {
  const offset = GLB_HEADER_SIZE + buffer.readUInt32LE(12);
  if (buffer.length < offset + GLB_CHUNK_HEADER_SIZE) return Buffer.alloc(0);
  return buffer.subarray(
    offset + GLB_CHUNK_HEADER_SIZE,
    offset + GLB_CHUNK_HEADER_SIZE + buffer.readUInt32LE(offset),
  );
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

function isIdentity(values, identity) {
  return values.every((value, index) => Math.abs(value - identity[index]) <= TRANSFORM_TOLERANCE);
}

function hasAppliedTransform(node) {
  return (
    isIdentity(node.matrix ?? IDENTITY_MATRIX, IDENTITY_MATRIX) &&
    Object.entries(IDENTITY_TRANSFORM).every(([key, identity]) =>
      isIdentity(node[key] ?? identity, identity),
    )
  );
}

function parentIndexes(gltf) {
  const parents = new Map();
  (gltf.nodes ?? []).forEach((node, index) => {
    for (const child of node.children ?? []) parents.set(child, index);
  });
  return parents;
}

function checkTransforms(gltf, nodes, fail) {
  const parents = parentIndexes(gltf);
  for (const node of nodes) {
    if (!hasAppliedTransform(node)) fail(`${node.name} has an unapplied transform`);
    let parent = parents.get(gltf.nodes.indexOf(node));
    while (parent !== undefined) {
      const ancestor = gltf.nodes[parent];
      if (!hasAppliedTransform(ancestor)) {
        fail(`${node.name} inherits an unapplied transform from ${ancestor.name}`);
      }
      parent = parents.get(parent);
    }
  }
}

function checkAnchors(gltf, nodes, expected, fail) {
  for (const node of nodes) {
    const children = new Map(
      (node.children ?? []).map((index) => [gltf.nodes[index].name, gltf.nodes[index]]),
    );
    for (const anchor of expected[node.name] ?? []) {
      const child = children.get(`${node.name}${ANCHOR_SEPARATOR}${anchor}`);
      if (!child) {
        fail(`${node.name} is missing anchor ${anchor}`);
      } else if (child.mesh !== undefined) {
        fail(`${node.name} anchor ${anchor} must be an empty, not a mesh`);
      } else if (anchor.startsWith(COLLISION_PREFIX) && (child.scale ?? [1]).some((v) => v <= 0)) {
        fail(`${node.name} anchor ${anchor} has no size`);
      }
    }
  }
}

function readUvPairs(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const view = gltf.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? UV_PAIR_SIZE;
  return Array.from({ length: accessor.count }, (_, index) => [
    bin.readFloatLE(start + index * stride),
    bin.readFloatLE(start + index * stride + UV_PAIR_SIZE / 2),
  ]);
}

function isOnPaletteRow([u, v], rowCount, [firstRow, endRow]) {
  const row = Math.floor(v * rowCount);
  const onCentre = Math.abs(v - (row + 0.5) / rowCount) <= PALETTE_ROW_TOLERANCE;
  return u >= 0 && u <= 1 && onCentre && row >= firstRow && row < endRow;
}

function checkImagePrimitive(gltf, bin, node, primitive, fail) {
  if (primitive.attributes.TEXCOORD_0 === undefined) {
    fail(`${node.name} has no image UV`);
    return;
  }
  const inside = readUvPairs(gltf, bin, primitive.attributes.TEXCOORD_0).every(
    ([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1,
  );
  if (!inside) fail(`${node.name} has an image UV outside 0..1`);
}

function checkPalette(gltf, bin, nodes, palette, fail) {
  const surfaceRows = palette.surface.length;
  const rowCount = surfaceRows + palette.glow.length;
  const rowsOf = { surface: [0, surfaceRows], glow: [surfaceRows, rowCount] };
  const images = new Set(palette.images ?? []);
  for (const node of nodes) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const material = (gltf.materials ?? [])[primitive.material]?.name;
      if (material === undefined) {
        fail(`${node.name} has a primitive without a material`);
      } else if (images.has(material)) {
        checkImagePrimitive(gltf, bin, node, primitive, fail);
      } else if (rowsOf[material] === undefined) {
        fail(`${node.name} uses material ${material} outside the palette`);
      } else if (primitive.attributes.TEXCOORD_0 === undefined) {
        fail(`${node.name} has no palette UV`);
      } else if (
        !readUvPairs(gltf, bin, primitive.attributes.TEXCOORD_0).every((pair) =>
          isOnPaletteRow(pair, rowCount, rowsOf[material]),
        )
      ) {
        fail(`${node.name} has a palette UV outside ${material} rows`);
      }
    }
  }
}

function meshBounds(gltf, mesh) {
  const positions = mesh.primitives.map(
    (primitive) => gltf.accessors[primitive.attributes.POSITION],
  );
  return [0, 1, 2].map((axis) => ({
    min: Math.min(...positions.map((accessor) => accessor.min[axis])),
    max: Math.max(...positions.map((accessor) => accessor.max[axis])),
  }));
}

function meshExtent(gltf, mesh) {
  return meshBounds(gltf, mesh).map(({ min, max }) => max - min);
}

function checkSizes(gltf, nodes, sizes, fail) {
  for (const node of nodes) {
    const limit = sizes[node.name];
    if (limit === undefined) continue;
    const extent = meshExtent(gltf, gltf.meshes[node.mesh]);
    if (extent.some((value, axis) => value > limit[axis])) {
      const measured = extent.map((value) => value.toFixed(3)).join(' x ');
      fail(`${node.name} is ${measured} m, larger than ${limit.join(' x ')}`);
    }
  }
}

function checkGrid(gltf, nodes, grids, fail) {
  for (const node of nodes) {
    const grid = grids[node.name];
    if (grid === undefined) continue;
    const bounds = meshBounds(gltf, gltf.meshes[node.mesh]);
    for (const axis of grid.axes) {
      const { min, max } = bounds[axis];
      const cells = (max - min) / grid.size;
      if (Math.abs(cells - Math.round(cells)) > GRID_TOLERANCE || Math.round(cells) === 0) {
        fail(
          `${node.name} spans ${(max - min).toFixed(3)} m on axis ${axis}, not a multiple of ${grid.size}`,
        );
      }
      if (Math.abs(min + max) > GRID_TOLERANCE * grid.size) {
        fail(`${node.name} is off the cell centre on axis ${axis}`);
      }
    }
  }
}

export function checkModel(file, gltf, expected, bin) {
  const errors = [];
  const fail = (message) => errors.push(`${file}: ${message}`);
  const meshNodes = (gltf.nodes ?? []).filter((node) => node.mesh !== undefined);
  checkMeshes(gltf, meshNodes, expected, fail);
  checkTransforms(gltf, meshNodes, fail);
  for (const material of gltf.materials ?? []) {
    if (NUMBERED_COPY.test(material.name)) fail(`duplicated material: ${material.name}`);
  }
  if (expected.bones) checkSkins(gltf, meshNodes, expected.bones, fail);
  checkClips(gltf, expected.clips ?? [], fail);
  checkAttributes(gltf, meshNodes, expected.attributes ?? {}, fail);
  checkAnchors(gltf, meshNodes, expected.anchors ?? {}, fail);
  checkSizes(gltf, meshNodes, expected.sizes ?? {}, fail);
  checkGrid(gltf, meshNodes, expected.grids ?? {}, fail);
  if (expected.palette) checkPalette(gltf, bin, meshNodes, expected.palette, fail);
  else if (expected.kit) fail('kits need a palette in the config');
  if (expected.kit) {
    const parts = Object.keys(expected.meshes);
    for (const message of checkCoplanar(gltf, bin, parts, roomAssemblies(parts))) fail(message);
  }
  return errors;
}

export function sourceFiles(config) {
  const { character, props, kits = [] } = config;
  return [
    ...new Set([
      character.rigSource,
      character.clipSource,
      ...Object.values(character.meshes).map((mesh) => mesh.source),
      ...props.map((prop) => prop.source),
      ...kits.map((kit) => kit.source),
    ]),
  ];
}

export function outputFiles(config) {
  return [
    config.character.file,
    config.character.lodFile,
    ...config.props.map((prop) => prop.file),
    ...(config.kits ?? []).map((kit) => kit.file),
  ];
}

function kitParts(kit) {
  return Object.entries(kit.slots).flatMap(([slot, spec]) =>
    spec.variants.map((variant) => ({ name: `${slot}_${variant}`, spec })),
  );
}

function kitExpectation(kit, palette) {
  const parts = kitParts(kit);
  const perPart = (pick) => Object.fromEntries(parts.map(({ name, spec }) => [name, pick(spec)]));
  return {
    file: kit.file,
    kit: true,
    meshes: perPart((spec) => spec.maxTriangles),
    anchors: perPart((spec) => spec.anchors ?? []),
    sizes: perPart((spec) => spec.size),
    grids: perPart((spec) => spec.grid),
    palette,
  };
}

function expectations(config) {
  const { bones, clips, character, props, kits = [], palette } = config;
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
    ...kits.map((kit) => kitExpectation(kit, palette)),
  ];
}

function hashFiles(folder, files) {
  return Object.fromEntries(
    files.map((file) => [file, contentId(readFileSync(join(folder, file)))]),
  );
}

function configHash(root) {
  return contentId(readFileSync(join(root, CONFIG_FILE)));
}

export function buildStamp(root, config) {
  return {
    config: configHash(root),
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

function listUndeclared(root, config) {
  const declared = new Set(sourceFiles(config));
  return readdirSync(join(root, 'source'))
    .filter((file) => file.endsWith('.blend') && !declared.has(file))
    .map((file) => `${file} is not declared in ${CONFIG_FILE}`);
}

export function checkStamp(root, config) {
  if (!existsSync(stampPath(root))) return [`${STAMP_FILE} is missing: run the export`];
  const stamp = JSON.parse(readFileSync(stampPath(root), 'utf8'));
  return [
    ...listUndeclared(root, config),
    ...(stamp.config === configHash(root) ? [] : [`${CONFIG_FILE} changed since the last export`]),
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
    if (!isLfsPointer(buffer)) {
      errors.push(...checkModel(expected.file, readGlb(buffer), expected, readGlbBinary(buffer)));
    } else if (requireContent) errors.push(`${expected.file} is an LFS pointer: fetch it first`);
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
  const errors = [...listUndeclared(root, config), ...checkContent(root, config, true).errors];
  if (errors.length === 0) {
    writeFileSync(stampPath(root), `${JSON.stringify(buildStamp(root, config), null, 2)}\n`);
  }
  return errors;
}
