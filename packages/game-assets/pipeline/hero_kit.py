import math
import os

import bmesh
import bpy
from mathutils import Vector

SURFACE_ROWS = ['body', 'metal', 'soft', 'top', 'floor', 'wall', 'ceiling', 'trim']
GLOW_ROWS = ['strip', 'keycap', 'screen', 'accent']
IMAGE_ROWS = ['display', 'decal', 'legend']
ROWS = SURFACE_ROWS + GLOW_ROWS
ALL_ROWS = ROWS + IMAGE_ROWS
CUT_SLOT = len(ALL_ROWS)
MATERIAL_ORDER = ['surface', 'glow', 'display', 'decal', 'legend']


def row_material(name):
    material = bpy.data.materials.get('row_' + name)
    if material is None:
        material = bpy.data.materials.new('row_' + name)
    return material


def rounded_rect(cx, cy, hw, hh, radius, corner=3):
    points = []
    centers = [(hw - radius, hh - radius, 0), (-hw + radius, hh - radius, 90), (-hw + radius, -hh + radius, 180), (hw - radius, -hh + radius, 270)]
    for ox, oy, start in centers:
        for i in range(corner + 1):
            a = math.radians(start + 90 * i / corner)
            points.append((cx + ox + radius * math.cos(a), cy + oy + radius * math.sin(a)))
    return points


def lerp_table(table, x):
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def table_slopes(table):
    xs = [x for x, _ in table]
    ys = [y for _, y in table]
    deltas = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(len(table) - 1)]
    slopes = [deltas[0]] + [0.0] * (len(table) - 2) + [deltas[-1]]
    for i in range(1, len(table) - 1):
        if deltas[i - 1] * deltas[i] > 0:
            left = xs[i] - xs[i - 1]
            right = xs[i + 1] - xs[i]
            w1 = 2 * right + left
            w2 = right + 2 * left
            slopes[i] = (w1 + w2) / (w1 / deltas[i - 1] + w2 / deltas[i])
    return slopes


def smooth_table(table, x):
    if x <= table[0][0]:
        return table[0][1]
    if x >= table[-1][0]:
        return table[-1][1]
    slopes = table_slopes(table)
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(table, table[1:])):
        if x <= x1:
            h = x1 - x0
            t = (x - x0) / h
            h00 = (1 + 2 * t) * (1 - t) ** 2
            h10 = t * (1 - t) ** 2
            h01 = t * t * (3 - 2 * t)
            h11 = t * t * (t - 1)
            return h00 * y0 + h10 * h * slopes[i] + h01 * y1 + h11 * h * slopes[i + 1]
    return table[-1][1]


class HeroPart:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.row_layer = self.bm.faces.layers.int.new('row')
        self.key_layer = self.bm.faces.layers.float.new('key_u')
        self.fixed_layer = self.bm.faces.layers.int.new('uv_fixed')
        self.uv_layer = self.bm.loops.layers.uv.new('palette')

    def _tag(self, faces, row, key_u=-1.0, smooth=False):
        for face in faces:
            face[self.row_layer] = ALL_ROWS.index(row)
            face[self.key_layer] = key_u
            face.smooth = smooth

    def poly(self, points, row):
        face = self.bm.faces.new([self.bm.verts.new(p) for p in points])
        self._tag([face], row)

    def image_rect(self, points, row, rect):
        u0, v0, u1, v1 = rect
        face = self.bm.faces.new([self.bm.verts.new(p) for p in points])
        self._tag([face], row)
        face[self.fixed_layer] = 1
        for loop, uv in zip(face.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
            loop[self.uv_layer].uv = uv

    def revolve(self, center, axis, profile, segments=14, smooth=True):
        center = Vector(center)
        sign = -1 if axis == 'y' else 1
        def point(radius, along, i):
            a = sign * 2 * math.pi * i / segments
            c, s = radius * math.cos(a), radius * math.sin(a)
            if axis == 'z':
                return center + Vector((c, s, along))
            if axis == 'y':
                return center + Vector((c, along, s))
            return center + Vector((along, c, s))
        rings = [[point(r, along, i) for i in range(segments)] for r, along, _ in profile]
        self.loft(rings, lambda r, c: profile[r][2], levels=0, smooth=smooth)

    def slab(self, cx, cy, hw, hh, radius, layers, corner=3):
        rings = []
        for z, inset, _ in layers:
            rings.append([Vector((x, y, z)) for x, y in rounded_rect(cx, cy, hw - inset, hh - inset, max(radius - inset, 0.001), corner)])
        self.loft(rings, lambda r, c: layers[r][2], levels=0, smooth=False)

    def slab_y(self, cx, cz, hw, hh, radius, layers, corner=3):
        rings = []
        for y, inset, _ in layers:
            points = rounded_rect(cx, cz, hw - inset, hh - inset, max(radius - inset, 0.001), corner)
            rings.append([Vector((x, y, z)) for x, z in reversed(points)])
        self.loft(rings, lambda r, c: layers[r][2], levels=0, smooth=False)

    def prism_x(self, outline, x0, x1, row):
        left = [(x0, y, z) for y, z in outline]
        right = [(x1, y, z) for y, z in outline]
        count = len(outline)
        faces = [list(reversed(range(count))), [count + i for i in range(count)]]
        for i in range(count):
            j = (i + 1) % count
            faces.append([i, j, count + j, count + i])
        self.add_cage(left + right, faces, [row] * len(faces), levels=0, smooth=False)

    def _absorb(self, mesh, smooth):
        before = set(self.bm.faces)
        self.bm.from_mesh(mesh)
        created = [f for f in self.bm.faces if f not in before]
        for face in created:
            face[self.row_layer] = face.material_index
            face[self.key_layer] = -1.0
            face.smooth = smooth
        self.last_faces = created

    def make_cutter(self, cutter):
        mesh = bpy.data.meshes.new('cutter')
        bm = bmesh.new()
        geom = bmesh.ops.create_cube(bm, size=1.0)
        size = cutter['size']
        for v in geom['verts']:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        edges = list({e for v in geom['verts'] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=cutter.get('radius', 0.01), segments=2, affect='EDGES', profile=0.5)
        for v in bm.verts:
            v.co += Vector(cutter['center'])
        bm.to_mesh(mesh)
        bm.free()
        for row_name in ALL_ROWS + ['cut']:
            mesh.materials.append(row_material(row_name))
        for polygon in mesh.polygons:
            polygon.material_index = CUT_SLOT
        ob = bpy.data.objects.new('cutter', mesh)
        bpy.context.scene.collection.objects.link(ob)
        return ob

    def add_cage(self, verts, faces, rows, levels=1, creases=None, smooth=True, cutters=None, cut_row='soft'):
        mesh = bpy.data.meshes.new('cage')
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        for row_name in ALL_ROWS + ['cut']:
            mesh.materials.append(row_material(row_name))
        for polygon, row in zip(mesh.polygons, rows):
            polygon.material_index = ALL_ROWS.index(row)
        mesh.update()
        ob = bpy.data.objects.new('cage', mesh)
        bpy.context.scene.collection.objects.link(ob)
        if creases:
            attribute = mesh.attributes.new('crease_edge', 'FLOAT', 'EDGE')
            lookup = {tuple(sorted(e.vertices)): e.index for e in mesh.edges}
            for pair, value in creases.items():
                index = lookup.get(tuple(sorted(pair)))
                if index is not None:
                    attribute.data[index].value = value
        if levels > 0:
            modifier = ob.modifiers.new('sub', 'SUBSURF')
            modifier.levels = levels
            modifier.render_levels = levels
        cutter_objects = [self.make_cutter(cutter) for cutter in (cutters or [])]
        for cutter_object in cutter_objects:
            boolean = ob.modifiers.new('cut', 'BOOLEAN')
            boolean.operation = 'DIFFERENCE'
            boolean.solver = 'EXACT'
            boolean.material_mode = 'INDEX'
            boolean.object = cutter_object
        depsgraph = bpy.context.evaluated_depsgraph_get()
        depsgraph.update()
        evaluated = ob.evaluated_get(depsgraph)
        result = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        before_faces = set(self.bm.faces)
        self._absorb(result, smooth)
        if cutter_objects:
            cut_index = ALL_ROWS.index(cut_row)
            for face in self.bm.faces:
                if face not in before_faces and face[self.row_layer] == CUT_SLOT:
                    face.smooth = False
                    face[self.row_layer] = cut_index
        for cutter_object in cutter_objects:
            cutter_mesh = cutter_object.data
            bpy.data.objects.remove(cutter_object)
            bpy.data.meshes.remove(cutter_mesh)
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(mesh)
        bpy.data.meshes.remove(result)

    def loft(self, rings, row_of, levels=1, closed=True, cap=True, smooth=True, cutters=None):
        verts, faces, rows = [], [], []
        width = len(rings[0])
        for ring in rings:
            verts.extend(ring)
        columns = width if closed else width - 1
        for r in range(len(rings) - 1):
            for c in range(columns):
                n = (c + 1) % width
                faces.append([r * width + c, r * width + n, (r + 1) * width + n, (r + 1) * width + c])
                rows.append(row_of(r, c))
        if cap and closed:
            faces.append(list(reversed(range(width))))
            rows.append(row_of(0, 0))
            last = (len(rings) - 1) * width
            faces.append([last + c for c in range(width)])
            rows.append(row_of(len(rings) - 2, 0))
        self.add_cage(verts, faces, rows, levels=levels, smooth=smooth, cutters=cutters)

    def tube(self, points, radius, row, sides=4, closed=False):
        points = [Vector(p) for p in points]
        rings = []
        count = len(points)
        for i, point in enumerate(points):
            if closed:
                tangent = points[(i + 1) % count] - points[i - 1]
            else:
                tangent = points[min(i + 1, count - 1)] - points[max(i - 1, 0)]
            tangent.normalize()
            helper = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
            side = tangent.cross(helper).normalized()
            up = side.cross(tangent).normalized()
            rings.append([
                point + (side * math.cos(2 * math.pi * s / sides) + up * math.sin(2 * math.pi * s / sides)) * radius
                for s in range(sides)
            ])
        if closed:
            rings.append(rings[0])
        verts, faces = [], []
        for ring in rings:
            verts.extend(ring)
        for r in range(len(rings) - 1):
            for s in range(sides):
                n = (s + 1) % sides
                faces.append([r * sides + s, (r + 1) * sides + s, (r + 1) * sides + n, r * sides + n])
        if not closed:
            faces.append(list(range(sides)))
            last = (len(rings) - 1) * sides
            faces.append(list(reversed([last + s for s in range(sides)])))
        self.add_cage(verts, faces, [row] * len(faces), levels=0, smooth=sides > 4)

    def cylinder_cap(self, center, axis, radius, side, row='body', segments=10):
        helper = Vector((0, 0, 1))
        forward = axis.cross(helper).normalized()
        up = axis.cross(forward).normalized()
        points = [center + forward * (radius * math.cos(2 * math.pi * i / segments)) + up * (radius * math.sin(2 * math.pi * i / segments)) for i in range(segments)]
        verts = [self.bm.verts.new(p) for p in (points if side > 0 else list(reversed(points)))]
        face = self.bm.faces.new(verts)
        face[self.row_layer] = ALL_ROWS.index(row)
        face.smooth = False
        bmesh.ops.recalc_face_normals(self.bm, faces=[face])
        if face.normal.dot(axis * side) < 0:
            bmesh.ops.reverse_faces(self.bm, faces=[face])

    def oriented_poly(self, points, outward, row):
        face = self.bm.faces.new([self.bm.verts.new(p) for p in points])
        self._tag([face], row)
        face.normal_update()
        if face.normal.dot(Vector(outward)) < 0:
            bmesh.ops.reverse_faces(self.bm, faces=[face])

    def pillow(self, center, size, row, puff=0.25, levels=2, top_row=None, grid=3):
        cx, cy, cz = center
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
        verts, faces, rows = [], [], []
        def index(i, j, k):
            return i * (grid + 1) * (grid + 1) + j * (grid + 1) + k
        for i in range(grid + 1):
            for j in range(grid + 1):
                for k in range(grid + 1):
                    x, y, z = (i / grid * 2 - 1), (j / grid * 2 - 1), (k / grid * 2 - 1)
                    edge_x, edge_z = abs(x), abs(z)
                    thick = 1 - puff * max(edge_x, edge_z) ** 2
                    verts.append((cx + x * sx, cy + y * sy * thick, cz + z * sz))
        used = {}
        out_verts = []
        def remap(v):
            if v not in used:
                used[v] = len(out_verts)
                out_verts.append(verts[v])
            return used[v]
        def quad(a, b, c, d, face_row):
            faces.append([remap(a), remap(b), remap(c), remap(d)])
            rows.append(face_row)
        accent = top_row or row
        for a in range(grid):
            for b in range(grid):
                quad(index(a, 0, b), index(a + 1, 0, b), index(a + 1, 0, b + 1), index(a, 0, b + 1), accent if a == 1 else row)
                quad(index(a, grid, b), index(a, grid, b + 1), index(a + 1, grid, b + 1), index(a + 1, grid, b), row)
                quad(index(0, a, b), index(0, a, b + 1), index(0, a + 1, b + 1), index(0, a + 1, b), row)
                quad(index(grid, a, b), index(grid, a + 1, b), index(grid, a + 1, b + 1), index(grid, a, b + 1), row)
                quad(index(a, b, 0), index(a, b + 1, 0), index(a + 1, b + 1, 0), index(a + 1, b, 0), row)
                quad(index(a, b, grid), index(a + 1, b, grid), index(a + 1, b + 1, grid), index(a, b + 1, grid), accent if a == 1 else row)
        self.add_cage(out_verts, faces, rows, levels=levels)

    def rounded_box(self, center, size, row, radius=0.01, segments=2):
        before = set(self.bm.faces)
        geom = bmesh.ops.create_cube(self.bm, size=1.0)
        for v in geom['verts']:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        edges = list({e for v in geom['verts'] for e in v.link_edges})
        bmesh.ops.bevel(self.bm, geom=edges, offset=radius, segments=segments, affect='EDGES', profile=0.5)
        created = [f for f in self.bm.faces if f not in before]
        for v in {v for f in created for v in f.verts}:
            v.co += Vector(center)
        self._tag(created, row)

    def spoke(self, start, end, width_start, width_end, height_start, height_end, row, levels=1):
        start, end = Vector(start), Vector(end)
        axis = (end - start).normalized()
        side = axis.cross(Vector((0, 0, 1))).normalized()
        up = side.cross(axis).normalized()
        rings = []
        for t in (0.0, 0.5, 1.0):
            center = start.lerp(end, t)
            w = width_start + (width_end - width_start) * t
            h = height_start + (height_end - height_start) * t
            rings.append([center - side * w + up * h * 0.4, center + side * w + up * h * 0.4, center + side * w * 0.8 - up * h, center - side * w * 0.8 - up * h])
        self.loft(rings, lambda r, c: row, levels=levels)

    def image_quad(self, points, row):
        verts = [self.bm.verts.new(p) for p in points]
        self._tag([self.bm.faces.new(verts)], row)


HARD_EDGE_DEGREES = 62


def finish_hero(part, collection, materials):
    bm = part.bm
    uv_layer = bm.loops.layers.uv.get('palette') or bm.loops.layers.uv.new('palette')
    low = min(v.co.x for v in bm.verts)
    high = max(v.co.x for v in bm.verts)
    span = max(high - low, 1e-6)
    groups = {}
    for face in bm.faces:
        groups.setdefault(face[part.row_layer], []).append(face)
    for row_index, faces in groups.items():
        name = ALL_ROWS[row_index]
        if name in IMAGE_ROWS:
            for face in faces:
                face.material_index = MATERIAL_ORDER.index(name)
                if face[part.fixed_layer]:
                    continue
                spans = [max(v.co[i] for v in face.verts) - min(v.co[i] for v in face.verts) for i in range(3)]
                flat_axis = spans.index(min(spans))
                u_axis, v_axis = [axis for axis in (0, 1, 2) if axis != flat_axis]
                if flat_axis == 1:
                    u_axis, v_axis = 0, 2
                lows = {axis: min(v.co[axis] for v in face.verts) for axis in (u_axis, v_axis)}
                for loop in face.loops:
                    loop[uv_layer].uv = (
                        (loop.vert.co[u_axis] - lows[u_axis]) / max(spans[u_axis], 1e-6),
                        (loop.vert.co[v_axis] - lows[v_axis]) / max(spans[v_axis], 1e-6),
                    )
            continue
        v_coord = 1 - (ROWS.index(name) + 0.5) / len(ROWS)
        for face in faces:
            face.material_index = 1 if name in GLOW_ROWS else 0
            for loop in face.loops:
                ratio = face[part.key_layer] if face[part.key_layer] >= 0 else (loop.vert.co.x - low) / span
                loop[uv_layer].uv = (0.02 + 0.96 * max(0.0, min(1.0, ratio)), v_coord)
    bm.faces.layers.int.remove(part.row_layer)
    bm.faces.layers.float.remove(part.key_layer)
    bm.faces.layers.int.remove(part.fixed_layer)
    mesh = bpy.data.meshes.new(part.name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.set_sharp_from_angle(angle=math.radians(HARD_EDGE_DEGREES))
    for material in materials:
        mesh.materials.append(material)
    ob = bpy.data.objects.new(part.name, mesh)
    collection.objects.link(ob)
    weight_normals_by_face_area(ob)
    return ob


def weight_normals_by_face_area(ob):
    modifier = ob.modifiers.new('weighted_normal', 'WEIGHTED_NORMAL')
    modifier.mode = 'FACE_AREA'
    modifier.weight = 50
    modifier.keep_sharp = True
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    weighted = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph), depsgraph=depsgraph)
    ob.modifiers.remove(modifier)
    plain = ob.data
    weighted.name = plain.name
    ob.data = weighted
    bpy.data.meshes.remove(plain)


LIGHTMAP_UV = 'lightmap'
LIGHTMAP_SIZE = 2048
SMALL_PART_TILE = 0.14
SMALL_PART_AREA_POWER = 0.65
PALETTE_UV = 'palette'
GLTF_OUTPUT_GROUP = 'glTF Material Output'


def select_objects(objects):
    for ob in bpy.context.view_layer.objects:
        ob.select_set(ob in objects)
    bpy.context.view_layer.objects.active = objects[0]


def unwrap_object(ob, margin):
    mesh = ob.data
    if LIGHTMAP_UV not in mesh.uv_layers:
        mesh.uv_layers.new(name=LIGHTMAP_UV)
    mesh.uv_layers.active = mesh.uv_layers[LIGHTMAP_UV]
    select_objects([ob])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def pack_tiles(areas, fill=0.86, minimum=0.08, gap=0.006, area_power=1.0):
    weights = {name: area ** area_power for name, area in areas.items()}
    total = sum(weights.values())
    sides = {name: max(minimum, math.sqrt(weight / total * fill)) for name, weight in weights.items()}
    order = sorted(sides, key=lambda name: -sides[name])
    scale = 1.0
    while True:
        tiles, x, y, row = {}, 0.0, 0.0, 0.0
        for name in order:
            side = sides[name] * scale
            if x + side > 1.0:
                x, y, row = 0.0, y + row + gap, 0.0
            tiles[name] = (x, y, side)
            x += side + gap
            row = max(row, side)
        if y + row <= 1.0:
            return tiles
        scale *= 0.96


def prepare_lightmap_uv(objects, size=LIGHTMAP_SIZE, gutter_pixels=4, minimum=0.08, area_power=1.0):
    areas = {ob.name: sum(polygon.area for polygon in ob.data.polygons) for ob in objects}
    tiles = pack_tiles(areas, minimum=minimum, area_power=area_power)
    for ob in objects:
        x0, y0, side = tiles[ob.name]
        unwrap_object(ob, gutter_pixels / (side * size))
        layer = ob.data.uv_layers[LIGHTMAP_UV]
        for item in layer.data:
            item.uv = (x0 + item.uv[0] * side, y0 + item.uv[1] * side)
        for uv_layer in ob.data.uv_layers:
            uv_layer.active_render = uv_layer.name == LIGHTMAP_UV
        ob.data.uv_layers.active = layer


def finish_lightmap_uv(objects):
    for ob in objects:
        ob.data.uv_layers.active = ob.data.uv_layers[PALETTE_UV]


def lightmap_image(name, size):
    import numpy
    image = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(numpy.ones(size * size * 4, dtype=numpy.float32))
    return image


def bake_occlusion(scene, objects, image, samples=256, distance=0.6, margin=3):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.use_clear = False
    scene.render.bake.margin = margin
    targets = []
    for material in {slot.material for ob in objects for slot in ob.material_slots if slot.material}:
        tree = material.node_tree
        node = tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        tree.nodes.active = node
        targets.append((tree, node))
    select_objects(objects)
    bpy.ops.object.bake(type='AO', margin=margin, use_clear=False)
    for tree, node in targets:
        tree.nodes.remove(node)


def soften_lightmap(image):
    import numpy
    width, height = image.size
    pixels = numpy.empty(width * height * 4, dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    grid = pixels.reshape(height, width, 4)
    for axis in (0, 1):
        grid = (numpy.roll(grid, 1, axis=axis) + 2 * grid + numpy.roll(grid, -1, axis=axis)) / 4
    image.pixels.foreach_set(grid.reshape(-1))


PREVIEW_SUFFIX = '-preview'


def preview_requested():
    return os.environ.get('ASSET_PREVIEW') == '1'


def preview_lightmap(image_name):
    return lightmap_image(image_name + PREVIEW_SUFFIX, 16)


def bake_isolated(scene, collection, built, surface, image_name, distance):
    parts = list(built.values())
    prepare_lightmap_uv(parts, minimum=SMALL_PART_TILE, area_power=SMALL_PART_AREA_POWER)
    if preview_requested():
        finish_lightmap_uv(parts)
        attach_occlusion(surface, preview_lightmap(image_name))
        return
    ground = ground_plane(collection)
    image = lightmap_image(image_name, LIGHTMAP_SIZE)
    for ob in parts:
        for other in parts:
            other.hide_render = other is not ob
        bake_occlusion(scene, [ob], image, distance=distance)
    for ob in parts:
        ob.hide_render = False
    soften_lightmap(image)
    remove_context([ground])
    finish_lightmap_uv(parts)
    attach_occlusion(surface, image)


def inert_material():
    material = bpy.data.materials.get('bake_context')
    if material is None:
        material = bpy.data.materials.new('bake_context')
    return material


def context_copy(collection, source, location, yaw=0.0):
    mesh = source.data.copy()
    mesh.name = source.name + '_context'
    mesh.materials.clear()
    mesh.materials.append(inert_material())
    ob = bpy.data.objects.new(source.name + '_context', mesh)
    ob.location = location
    ob.rotation_euler = (0.0, 0.0, yaw)
    collection.objects.link(ob)
    return ob


def ground_plane(collection, half=3.0):
    mesh = bpy.data.meshes.new('ground_context')
    mesh.from_pydata([(-half, -half, 0), (half, -half, 0), (half, half, 0), (-half, half, 0)], [], [[0, 1, 2, 3]])
    ob = bpy.data.objects.new('ground_context', mesh)
    collection.objects.link(ob)
    return ob


def remove_context(objects):
    for ob in objects:
        mesh = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(mesh)


def attach_occlusion(material, image):
    group = bpy.data.node_groups.get(GLTF_OUTPUT_GROUP)
    if group is None:
        group = bpy.data.node_groups.new(GLTF_OUTPUT_GROUP, 'ShaderNodeTree')
        group.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        group.nodes.new('NodeGroupInput')
    tree = material.node_tree
    uv = tree.nodes.new('ShaderNodeUVMap')
    uv.uv_map = LIGHTMAP_UV
    texture = tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    output = tree.nodes.new('ShaderNodeGroup')
    output.node_tree = group
    tree.links.new(uv.outputs['UV'], texture.inputs['Vector'])
    tree.links.new(texture.outputs['Color'], output.inputs['Occlusion'])
    image.file_format = 'JPEG'
    image.pack()


def anchor(owner, name, collection, location, scale=None):
    ob = bpy.data.objects.new('{}__{}'.format(owner.name, name), None)
    ob.parent = owner
    ob.location = location
    if scale is None:
        ob.empty_display_type = 'ARROWS'
        ob.empty_display_size = 0.08
    else:
        ob.scale = scale
        ob.empty_display_type = 'CUBE'
    collection.objects.link(ob)
