const AXIS_ALIGNMENT = 1 - 1e-4;
const PLANE_TOLERANCE = 1.5e-3;
const WELD_TOLERANCE = 1e-6;
const MIN_OVERLAP_AREA = 1e-5;
const BURIED_FRACTION = 0.98;
const COMPONENT_READERS = {
  5121: (bin, offset) => bin.readUInt8(offset),
  5123: (bin, offset) => bin.readUInt16LE(offset),
  5125: (bin, offset) => bin.readUInt32LE(offset),
  5126: (bin, offset) => bin.readFloatLE(offset),
};
const COMPONENT_SIZES = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_LENGTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const AXIS_NAMES = ['x', 'y', 'z'];
const CELL = 2;

export function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index];
  const length = TYPE_LENGTHS[accessor.type];
  const read = COMPONENT_READERS[accessor.componentType];
  if (accessor.bufferView === undefined || !read) {
    return Array.from({ length: accessor.count }, () =>
      length === 1 ? 0 : Array.from({ length }, () => 0),
    );
  }
  const view = gltf.bufferViews[accessor.bufferView];
  const size = COMPONENT_SIZES[accessor.componentType];
  const stride = view.byteStride ?? size * length;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count }, (_, item) => {
    const base = start + item * stride;
    if (length === 1) return read(bin, base);
    return Array.from({ length }, (_, component) => read(bin, base + component * size));
  });
}

export function partTriangles(gltf, bin, name) {
  const node = (gltf.nodes ?? []).find((candidate) => candidate.name === name);
  const triangles = [];
  if (!node || node.mesh === undefined) return triangles;
  const hasData = (index) => index !== undefined && gltf.accessors[index].bufferView !== undefined;
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    if (!hasData(primitive.attributes.POSITION)) continue;
    if (primitive.indices !== undefined && !hasData(primitive.indices)) continue;
    const positions = readAccessor(gltf, bin, primitive.attributes.POSITION);
    const indices =
      primitive.indices === undefined
        ? positions.map((_, index) => index)
        : readAccessor(gltf, bin, primitive.indices);
    for (let i = 0; i + 2 < indices.length; i += 3) {
      triangles.push([positions[indices[i]], positions[indices[i + 1]], positions[indices[i + 2]]]);
    }
  }
  return triangles;
}

export function placeTriangles(triangles, [tx, ty, tz], yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return triangles.map((triangle) =>
    triangle.map(([x, y, z]) => [x * cos + z * sin + tx, y + ty, -x * sin + z * cos + tz]),
  );
}

function signedArea(polygon) {
  let total = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    total += x0 * y1 - x1 * y0;
  }
  return total / 2;
}

export function connectedComponents(triangles) {
  const ids = new Map();
  const parent = [];
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const vertexId = (point) => {
    const key = point.map((value) => Math.round(value / WELD_TOLERANCE)).join(',');
    if (!ids.has(key)) {
      ids.set(key, parent.length);
      parent.push(parent.length);
    }
    return ids.get(key);
  };
  const firsts = triangles.map(([a, b, c]) => {
    const [ia, ib, ic] = [vertexId(a), vertexId(b), vertexId(c)];
    parent[find(ib)] = find(ia);
    parent[find(ic)] = find(ia);
    return ia;
  });
  return firsts.map((first) => find(first));
}

function axisFace(triangle) {
  const [a, b, c] = triangle;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...normal);
  if (length < 1e-12) return null;
  const axis = normal.findIndex((component) => Math.abs(component) / length >= AXIS_ALIGNMENT);
  if (axis < 0) return null;
  const sign = Math.sign(normal[axis]);
  const [p, q] = [(axis + 1) % 3, (axis + 2) % 3];
  const polygon = triangle.map((point) => [point[p], point[q]]);
  if (signedArea(polygon) < 0) polygon.reverse();
  return { axis, sign, coord: (a[axis] + b[axis] + c[axis]) / 3, polygon, p, q };
}

function clipByEdge(polygon, [ax, ay], [bx, by]) {
  const side = ([x, y]) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const output = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentSide = side(current);
    const previousSide = side(previous);
    if (currentSide >= 0 !== previousSide >= 0) {
      const t = previousSide / (previousSide - currentSide);
      output.push([
        previous[0] + (current[0] - previous[0]) * t,
        previous[1] + (current[1] - previous[1]) * t,
      ]);
    }
    if (currentSide >= 0) output.push(current);
  }
  return output;
}

export function clipPolygon(subject, convex) {
  let polygon = subject;
  for (let i = 0; i < convex.length && polygon.length > 0; i += 1) {
    polygon = clipByEdge(polygon, convex[i], convex[(i + 1) % convex.length]);
  }
  return polygon.length < 3 ? [] : polygon;
}

export function overlapArea(first, second) {
  return Math.abs(signedArea(clipPolygon(first, second)));
}

function centroid(polygon) {
  const [x, y] = polygon.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
  return [x / polygon.length, y / polygon.length];
}

function planeKey(axis, sign, bucket) {
  return `${axis}:${sign}:${bucket}`;
}

function indexByPlane(faces) {
  const index = new Map();
  for (const face of faces) {
    const key = planeKey(face.axis, face.sign, Math.round(face.coord / PLANE_TOLERANCE));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(face);
  }
  return index;
}

function facesOnPlane(index, axis, sign, coord) {
  const bucket = Math.round(coord / PLANE_TOLERANCE);
  return [-1, 0, 1]
    .flatMap((step) => index.get(planeKey(axis, sign, bucket + step)) ?? [])
    .filter((face) => Math.abs(face.coord - coord) <= PLANE_TOLERANCE);
}

function isBuried(polygon, area, opposite, components) {
  let covered = 0;
  for (const face of opposite) {
    if (components.has(face.component)) continue;
    covered += overlapArea(polygon, face.polygon);
    if (covered >= area * BURIED_FRACTION) return true;
  }
  return false;
}

export function coplanarOverlaps(placements, { acrossOnly = false } = {}) {
  const faces = [];
  placements.forEach(({ label, triangles }, owner) => {
    const components = connectedComponents(triangles);
    triangles.forEach((triangle, index) => {
      const face = axisFace(triangle);
      if (face) faces.push({ ...face, label, owner, component: `${owner}:${components[index]}` });
    });
  });
  faces.sort((a, b) => a.axis - b.axis || a.sign - b.sign || a.coord - b.coord);
  const index = indexByPlane(faces);
  const overlaps = [];
  for (let i = 0; i < faces.length; i += 1) {
    const face = faces[i];
    for (let j = i + 1; j < faces.length; j += 1) {
      const other = faces[j];
      if (other.axis !== face.axis || other.sign !== face.sign) break;
      if (other.coord - face.coord > PLANE_TOLERANCE) break;
      if (acrossOnly && other.owner === face.owner) continue;
      const polygon = clipPolygon(face.polygon, other.polygon);
      const area = Math.abs(signedArea(polygon));
      if (area < MIN_OVERLAP_AREA) continue;
      const opposite = facesOnPlane(index, face.axis, -face.sign, face.coord);
      if (isBuried(polygon, area, opposite, new Set([face.component, other.component]))) continue;
      const [p, q] = centroid(polygon);
      const at = [];
      at[face.axis] = face.coord;
      at[face.p] = p;
      at[face.q] = q;
      overlaps.push({
        axis: AXIS_NAMES[face.axis],
        sign: face.sign > 0 ? '+' : '-',
        coord: face.coord,
        gap: Math.abs(other.coord - face.coord),
        area,
        at,
        labels: [face.label, other.label],
      });
    }
  }
  return overlaps;
}

export function describeOverlaps(name, overlaps) {
  const worst = overlaps.reduce((best, item) => (item.area > best.area ? item : best));
  const at = worst.at.map((value) => value.toFixed(3)).join(', ');
  const pair = worst.labels[0] === worst.labels[1] ? worst.labels[0] : worst.labels.join(' and ');
  const gap = worst.gap < 1e-6 ? 'in the same plane' : `${(worst.gap * 1e3).toFixed(2)} mm apart`;
  return `${name}: ${overlaps.length} coplanar overlaps, largest ${(worst.area * 1e4).toFixed(1)} cm² on ${worst.sign}${worst.axis} at ${worst.coord.toFixed(4)} (${gap}) near (${at}) in ${pair}`;
}

export function roomAssemblies(parts) {
  const variants = (slot) => parts.filter((name) => name.startsWith(`${slot}_`));
  const assemblies = [];
  for (const wall of variants('wall')) {
    assemblies.push({
      name: `${wall} beside ${wall}`,
      places: [
        [wall, [-1, 0, 0], 0],
        [wall, [1, 0, 0], 0],
      ],
    });
    for (const corner of variants('corner')) {
      assemblies.push({
        name: `${corner} with ${wall}`,
        places: [
          [corner, [0, 0, 0], 0],
          [wall, [CELL, 0, 0], 0],
          [wall, [0, 0, -CELL], -Math.PI / 2],
        ],
      });
    }
    for (const opening of [...variants('door'), ...variants('window')]) {
      assemblies.push({
        name: `${opening} between ${wall}`,
        places: [
          [wall, [-CELL, 0, 0], 0],
          [opening, [0, 0, 0], 0],
          [wall, [CELL, 0, 0], 0],
        ],
      });
    }
  }
  return assemblies;
}

const STOREY = 3.4;
const LOT = 4;

export function facadeAssemblies(parts) {
  const variants = (slot) => parts.filter((name) => name.startsWith(`${slot}_`));
  const assemblies = [];
  const storeys = variants('storey');
  for (const shopfront of variants('shopfront')) {
    for (const lower of storeys) {
      for (const upper of storeys) {
        for (const roof of variants('roof')) {
          assemblies.push({
            name: `${shopfront} under ${lower} under ${upper} under ${roof}`,
            places: [
              [shopfront, [0, 0, 0], 0],
              [lower, [0, STOREY, 0], 0],
              [upper, [0, STOREY * 2, 0], 0],
              [roof, [0, STOREY * 3, 0], 0],
            ],
          });
        }
      }
    }
  }
  for (const slot of ['shopfront', 'storey', 'roof']) {
    for (const part of variants(slot)) {
      assemblies.push({
        name: `${part} beside ${part}`,
        places: [
          [part, [0, 0, 0], 0],
          [part, [LOT, 0, 0], 0],
        ],
      });
    }
  }
  return assemblies;
}

export function kitOverlaps(gltf, bin, parts, assemblies = []) {
  const cache = new Map();
  const trianglesOf = (name) => {
    if (!cache.has(name)) cache.set(name, partTriangles(gltf, bin, name));
    return cache.get(name);
  };
  const results = parts.map((name) => ({
    name,
    overlaps: coplanarOverlaps([{ label: name, triangles: trianglesOf(name) }]),
  }));
  for (const { name, places } of assemblies) {
    const placements = places.map(([part, offset, yaw], index) => ({
      label: `${part}#${index + 1}`,
      triangles: placeTriangles(trianglesOf(part), offset, yaw),
    }));
    results.push({ name, overlaps: coplanarOverlaps(placements, { acrossOnly: true }) });
  }
  return results;
}

export function checkCoplanar(gltf, bin, parts, assemblies = []) {
  return kitOverlaps(gltf, bin, parts, assemblies)
    .filter(({ overlaps }) => overlaps.length > 0)
    .map(({ name, overlaps }) => describeOverlaps(name, overlaps));
}
