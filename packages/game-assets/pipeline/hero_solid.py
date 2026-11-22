import math

import bmesh
from mathutils import Matrix, Vector

from hero_kit import ALL_ROWS


def tag(part, faces, row, key_u=None, smooth=False):
    part._tag(faces, row, -1.0 if key_u is None else key_u, smooth)


def rbox(part, center, size, row, radius=0.0, segments=1, rot=None, key_u=None):
    bm = part.bm
    before = set(bm.faces)
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom['verts']
    for v in verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if radius > 0:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=radius, segments=segments, affect='EDGES', profile=0.5)
    created = [f for f in bm.faces if f not in before]
    origin = Vector(center)
    for v in {v for f in created for v in f.verts}:
        p = v.co.copy()
        if rot is not None:
            p = rot @ p
        v.co = p + origin
    tag(part, created, row, key_u)
    return created


def axis_matrix(direction, up=(0.0, 0.0, 1.0)):
    x_axis = Vector(direction).normalized()
    up_v = Vector(up)
    if abs(x_axis.dot(up_v)) > 0.99:
        up_v = Vector((0.0, 1.0, 0.0)) if abs(x_axis.y) < 0.9 else Vector((1.0, 0.0, 0.0))
    z_axis = up_v - x_axis * up_v.dot(x_axis)
    z_axis.normalize()
    y_axis = z_axis.cross(x_axis)
    return Matrix((x_axis, y_axis, z_axis)).transposed()


def obox(part, start, end, width, height, row, radius=0.0, up=(0.0, 0.0, 1.0), key_u=None):
    start, end = Vector(start), Vector(end)
    center = (start + end) * 0.5
    length = (end - start).length
    return rbox(part, center, (length, width, height), row, radius, 1, axis_matrix(end - start, up), key_u)


def prism_x(part, outline, x0, x1, row, z0=0.0, z1=0.0, key_u=None):
    bm = part.bm
    near = [bm.verts.new((x0, y, z + z0)) for y, z in outline]
    far = [bm.verts.new((x1, y, z + z1)) for y, z in outline]
    faces = [bm.faces.new(list(reversed(near))), bm.faces.new(far)]
    count = len(outline)
    for i in range(count):
        j = (i + 1) % count
        faces.append(bm.faces.new([near[i], near[j], far[j], far[i]]))
    tag(part, faces, row, key_u)
    return faces


def prism_y(part, outline, y0, y1, row, key_u=None):
    bm = part.bm
    near = [bm.verts.new((x, y0, z)) for x, z in outline]
    far = [bm.verts.new((x, y1, z)) for x, z in outline]
    faces = [bm.faces.new(near), bm.faces.new(list(reversed(far)))]
    count = len(outline)
    for i in range(count):
        j = (i + 1) % count
        faces.append(bm.faces.new([near[i], far[i], far[j], near[j]]))
    tag(part, faces, row, key_u)
    return faces


def prism_z(part, outline, z0, z1, row, key_u=None):
    bm = part.bm
    low = [bm.verts.new((x, y, z0)) for x, y in outline]
    high = [bm.verts.new((x, y, z1)) for x, y in outline]
    faces = [bm.faces.new(list(reversed(low))), bm.faces.new(high)]
    count = len(outline)
    for i in range(count):
        j = (i + 1) % count
        faces.append(bm.faces.new([low[i], low[j], high[j], high[i]]))
    tag(part, faces, row, key_u)
    return faces


def cyl(part, start, end, radius, row, sides=8, end_radius=None, key_u=None):
    bm = part.bm
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    helper = Vector((0.0, 0.0, 1.0)) if abs(axis.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    side = axis.cross(helper).normalized()
    up = axis.cross(side)
    far_radius = radius if end_radius is None else end_radius
    near = []
    far = []
    for i in range(sides):
        angle = 2 * math.pi * i / sides
        direction = side * math.cos(angle) + up * math.sin(angle)
        near.append(bm.verts.new(start + direction * radius))
        far.append(bm.verts.new(end + direction * far_radius))
    caps = [bm.faces.new(list(reversed(near))), bm.faces.new(far)]
    walls = []
    for i in range(sides):
        j = (i + 1) % sides
        walls.append(bm.faces.new([near[i], near[j], far[j], far[i]]))
    tag(part, caps, row, key_u)
    tag(part, walls, row, key_u, smooth=sides >= 8)
    return caps + walls


def bolt(part, center, direction, radius, height, row='metal'):
    base = Vector(center)
    cyl(part, base, base + Vector(direction).normalized() * height, radius, row, sides=6)


def slope_prism(part, x0, x1, y0, y1, bottom0, bottom1, top0, top1, row, key_u=None):
    if abs(bottom0 - top0) < 1e-6:
        return prism_y(part, [(x0, bottom0), (x1, bottom1), (x1, top1)], y0, y1, row, key_u)
    if abs(bottom1 - top1) < 1e-6:
        return prism_y(part, [(x0, bottom0), (x1, bottom1), (x0, top0)], y0, y1, row, key_u)
    return prism_y(part, [(x0, bottom0), (x1, bottom1), (x1, top1), (x0, top0)], y0, y1, row, key_u)


def set_row(part, faces, row):
    for face in faces:
        face[part.row_layer] = ALL_ROWS.index(row)


def mirror_outline(outline):
    return [(-y, z) for y, z in reversed(outline)]
