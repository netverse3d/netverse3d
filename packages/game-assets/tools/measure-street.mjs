import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { streetAssemblyPlan, streetDrawCounts } from '../runtime/street-instancing.mjs';
import { streetPlan } from '../runtime/street-look.mjs';
import { parkedVehiclePlacements } from '../runtime/traffic.mjs';
import { readGlb, readGlbBinary } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const block = JSON.parse(readFileSync(join(root, 'blocks/hem-mau.json'), 'utf8'));

function load(file) {
  const buffer = readFileSync(join(root, 'exported', file));
  return { gltf: readGlb(buffer), bin: readGlbBinary(buffer) };
}

function partMeshes(gltf, part) {
  const rootNode = gltf.nodes.findIndex((node) => node.name === part);
  if (rootNode < 0) throw new Error(`kit has no part ${part}`);
  const meshes = [];
  function visit(index) {
    const node = gltf.nodes[index];
    if (node.mesh !== undefined) meshes.push({ name: node.name, mesh: gltf.meshes[node.mesh] });
    for (const child of node.children ?? []) visit(child);
  }
  visit(rootNode);
  return meshes;
}

function triangles(gltf, mesh) {
  return mesh.primitives.reduce(
    (total, primitive) =>
      total + gltf.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3,
    0,
  );
}

function dimensions(bytes) {
  for (let offset = 2; offset < bytes.length - 9;) {
    if (bytes[offset] !== 0xff) throw new Error('invalid JPEG marker');
    const marker = bytes[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker))
      return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('JPEG dimensions not found');
}

const street = load('street-parts.glb');
const vehicles = load('vehicle-parts.glb');
const plan = streetPlan(block);
const parts = [...new Set(plan.map((placement) => placement.part))];
const primitiveNames = Object.fromEntries(
  parts.map((part) => [
    part,
    partMeshes(street.gltf, part).flatMap(({ name, mesh }) => mesh.primitives.map(() => name)),
  ]),
);
const groups = streetAssemblyPlan(plan, primitiveNames);
const streetCalls = streetDrawCounts(groups);
const streetTriangles = plan.reduce(
  (total, placement) =>
    total +
    partMeshes(street.gltf, placement.part).reduce(
      (sum, { mesh }) => sum + triangles(street.gltf, mesh),
      0,
    ),
  0,
);
const vehiclePlan = [...parkedVehiclePlacements(block), { part: 'car_a' }, { part: 'motorbike_b' }];
const vehicleCalls = vehiclePlan.reduce(
  (total, placement) =>
    total +
    partMeshes(vehicles.gltf, placement.part).reduce(
      (sum, { mesh }) => sum + mesh.primitives.length,
      0,
    ),
  0,
);
const vehicleTriangles = vehiclePlan.reduce(
  (total, placement) =>
    total +
    partMeshes(vehicles.gltf, placement.part).reduce(
      (sum, { mesh }) => sum + triangles(vehicles.gltf, mesh),
      0,
    ),
  0,
);
const images = [street, vehicles].flatMap(({ gltf, bin }) =>
  (gltf.images ?? []).map((image) => {
    const view = gltf.bufferViews[image.bufferView];
    const [width, height] = dimensions(
      bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength),
    );
    return { width, height, bytesWithMips: Math.round(width * height * 4 * 1.33) };
  }),
);
console.log(
  JSON.stringify(
    {
      placements: plan.length,
      vehicles: vehiclePlan.length,
      streetCalls,
      vehicleCalls,
      beforeCalls: streetCalls.before + vehicleCalls,
      afterCalls: streetCalls.after + vehicleCalls,
      streetTriangles,
      vehicleTriangles,
      totalTriangles: streetTriangles + vehicleTriangles,
      images,
      textureBytesWithMips: images.reduce((total, image) => total + image.bytesWithMips, 0),
    },
    null,
    2,
  ),
);
