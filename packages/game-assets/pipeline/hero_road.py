from math import cos, pi, sin
from random import Random

import bmesh
from mathutils import Vector

from hero_kit import HeroPart
from hero_solid import prism_z, rbox, tag

CELL = 4.0
HALF = CELL / 2.0
ROAD_DEPTH = 0.20
SIDEWALK_TOP = 0.15
MARK_BOTTOM = 0.002
MARK_TOP = 0.005


def _bevel_edges(part, edges, offset, segments=1):
    if not edges:
        return
    bmesh.ops.bevel(part.bm, geom=edges, offset=offset, segments=segments, affect='EDGES', profile=0.5)


def _triangulate_ngons(bm):
    ngons = [face for face in bm.faces if len(face.verts) > 4]
    if ngons:
        bmesh.ops.triangulate(bm, faces=ngons)


def _asphalt_top_grid(bm, x_cuts, y_cuts, z=0.0):
    return [[bm.verts.new((x, y, z)) for y in y_cuts] for x in x_cuts]


def _fill_top_cells(part, top, cell_rows):
    bm = part.bm
    nx = len(top)
    ny = len(top[0])
    faces = []
    for ix in range(nx - 1):
        for iy in range(ny - 1):
            f = bm.faces.new([top[ix][iy], top[ix + 1][iy], top[ix + 1][iy + 1], top[ix][iy + 1]])
            tag(part, [f], cell_rows.get((ix, iy), 'wall'))
            faces.append(f)
    return faces


def _lane_cell_rows(x_cuts, y_cuts, patches):
    rows = {}
    for ix in range(len(x_cuts) - 1):
        cx = 0.5 * (x_cuts[ix] + x_cuts[ix + 1])
        for iy in range(len(y_cuts) - 1):
            cy = 0.5 * (y_cuts[iy] + y_cuts[iy + 1])
            row = None
            for rects, patch_row in patches:
                if any(x0 < cx < x1 and y0 < cy < y1 for x0, x1, y0, y1 in rects):
                    row = patch_row
                    break
            if row is None and (-1.09 < cy < -0.61 or 0.61 < cy < 1.09):
                row = 'body'
            if row is not None:
                rows[(ix, iy)] = row
    return rows


def _asphalt_slab(part, x_cuts, y_cuts, cell_rows, z0=-ROAD_DEPTH, z1=0.0):
    bm = part.bm
    nx = len(x_cuts)
    ny = len(y_cuts)
    top = _asphalt_top_grid(bm, x_cuts, y_cuts, z1)
    _fill_top_cells(part, top, cell_rows)

    perim_top = (
        [top[ix][0] for ix in range(nx - 1)]
        + [top[nx - 1][iy] for iy in range(ny - 1)]
        + [top[ix][ny - 1] for ix in range(nx - 1, 0, -1)]
        + [top[0][iy] for iy in range(ny - 1, 0, -1)]
    )
    perim_bot = [bm.verts.new((v.co.x, v.co.y, z0)) for v in perim_top]
    side_faces = []
    count = len(perim_top)
    for i in range(count):
        j = (i + 1) % count
        side_faces.append(bm.faces.new([perim_top[i], perim_top[j], perim_bot[j], perim_bot[i]]))
    bottom_face = bm.faces.new(list(reversed(perim_bot)))
    tag(part, side_faces + [bottom_face], 'body')
    bmesh.ops.recalc_face_normals(bm, faces=side_faces + [bottom_face])
    _triangulate_ngons(bm)


def _manhole_cover(part, cx, cy):
    rim_pts = [(cx + 0.30 * cos(2 * pi * i / 12), cy + 0.30 * sin(2 * pi * i / 12)) for i in range(12)]
    prism_z(part, rim_pts, -0.002, 0.003, 'metal')
    lid_pts = [(cx + 0.24 * cos(2 * pi * i / 10), cy + 0.24 * sin(2 * pi * i / 10)) for i in range(10)]
    prism_z(part, lid_pts, 0.001, 0.005, 'body')
    _triangulate_ngons(part.bm)


def _lane_c_body(part, x_cuts, y_cuts, cell_rows):
    bm = part.bm
    nx = len(x_cuts)
    ny = len(y_cuts)
    gutter_profile = [
        (-2.00, -ROAD_DEPTH),
        (-2.00, 0.00),
        (-1.94, 0.00),
        (-1.93, -0.035),
        (-1.70, -0.035),
    ]
    gutter_cols = [[bm.verts.new((x, y, z)) for y, z in gutter_profile] for x in x_cuts]
    top = _asphalt_top_grid(bm, x_cuts, y_cuts, 0.0)
    asphalt_faces = _fill_top_cells(part, top, cell_rows)

    gutter_faces = []
    for ix in range(nx - 1):
        c0 = gutter_cols[ix] + [top[ix][0]]
        c1 = gutter_cols[ix + 1] + [top[ix + 1][0]]
        for k in range(len(c0) - 1):
            gutter_faces.append(bm.faces.new([c0[k], c0[k + 1], c1[k + 1], c1[k]]))

    back_top = [top[ix][ny - 1] for ix in range(nx)]
    back_bot = [bm.verts.new((v.co.x, v.co.y, -ROAD_DEPTH)) for v in back_top]
    side_faces = []
    for ix in range(nx - 1):
        side_faces.append(bm.faces.new([back_top[ix + 1], back_top[ix], back_bot[ix], back_bot[ix + 1]]))
        side_faces.append(bm.faces.new([gutter_cols[ix][0], gutter_cols[ix + 1][0], back_bot[ix + 1], back_bot[ix]]))

    near_loop = gutter_cols[0] + [top[0][iy] for iy in range(ny)] + [back_bot[0]]
    far_loop = gutter_cols[-1] + [top[-1][iy] for iy in range(ny)] + [back_bot[-1]]
    end_near = bm.faces.new(list(reversed(near_loop)))
    end_far = bm.faces.new(far_loop)
    other_faces = gutter_faces + side_faces + [end_near, end_far]
    bmesh.ops.recalc_face_normals(bm, faces=asphalt_faces + other_faces)
    tag(part, other_faces, 'body')

    sharp_top = [
        e
        for e in bm.edges
        if all(v.co.z > -0.005 for v in e.verts)
        and all(v.co.y < -1.68 for v in e.verts)
        and abs(e.verts[0].co.y - e.verts[1].co.y) < 0.02
        and e.calc_face_angle(0.0) > 0.5
    ]
    before_bevel = set(bm.faces)
    _bevel_edges(part, sharp_top, 0.004, segments=1)
    for face in bm.faces:
        if face not in before_bevel:
            tag(part, [face], 'body')
    _triangulate_ngons(bm)


def build_lane(variant):
    part = HeroPart(f'lane_{variant}')
    if variant == 'a':
        x_cuts = [-HALF, -1.45, -0.85, -0.25, 0.55, 1.50, HALF]
        y_cuts = [-HALF, -1.09, -0.61, -0.35, 0.15, 0.61, 1.09, 1.18, 1.84, HALF]
        patches = [
            ([(-1.45, -0.85, -0.35, 0.61), (-0.85, -0.25, -0.35, 0.15)], 'soft'),
            ([(0.55, 1.50, 1.18, 1.84)], 'floor'),
        ]
        _asphalt_slab(part, x_cuts, y_cuts, _lane_cell_rows(x_cuts, y_cuts, patches))
        for cx, length in ((-1.38, 0.84), (-0.18, 0.72), (1.16, 0.96)):
            rbox(part, (cx, -1.92, 0.001), (length, 0.12, 0.004), 'metal')
        return part

    if variant == 'b':
        x_cuts = [-HALF, -0.45, 0.45, 1.00, 1.55, HALF]
        y_cuts = [-HALF, -1.72, -1.09, -0.61, -0.42, -0.02, 0.42, 0.61, 1.09, HALF]
        patches = [
            ([(-0.45, 0.45, -1.72, -1.09)], 'soft'),
            ([(0.45, 1.00, -0.42, 0.42), (1.00, 1.55, -0.02, 0.42)], 'floor'),
        ]
        _asphalt_slab(part, x_cuts, y_cuts, _lane_cell_rows(x_cuts, y_cuts, patches))
        rbox(part, (-0.70, -1.92, 0.001), (2.56, 0.12, 0.004), 'metal')
        rbox(part, (1.31, -1.92, 0.001), (1.34, 0.12, 0.004), 'metal')
        _manhole_cover(part, -1.05, 1.42)
        return part

    x_cuts = [-HALF, -1.50, -0.90, -0.25, 0.45, 1.40, HALF]
    y_cuts = [-1.69, -1.09, -0.61, -0.40, 0.30, 0.61, 1.09, 1.80, HALF]
    patches = [
        ([(-1.50, -0.90, 0.61, 1.80), (-0.90, -0.25, 1.09, 1.80)], 'soft'),
        ([(0.45, 1.40, -0.40, 0.30)], 'floor'),
    ]
    _lane_c_body(part, x_cuts, y_cuts, _lane_cell_rows(x_cuts, y_cuts, patches))
    for gx in (-1.25, 0.0, 1.25):
        rbox(part, (gx, -1.815, -0.009), (0.68, 0.25, 0.014), 'metal')
    return part


def _shrub_lump(part, center, radii, seed, row, z_floor=0.27):
    bm = part.bm
    rng = Random(seed)
    cx, cy, cz = center
    rx, ry, rz = radii
    geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    verts = geom['verts']
    for v in verts:
        p = v.co
        jitter = rng.uniform(0.76, 1.24)
        vz = p.z * rz * jitter
        if p.z < 0:
            vz *= 0.68
        v.co = Vector((cx + p.x * rx * jitter, cy + p.y * ry * jitter, max(z_floor, cz + vz)))
    faces = list({f for v in verts for f in v.link_faces})
    z_min = min(v.co.z for v in verts)
    z_span = max(max(v.co.z for v in verts) - z_min, 1e-4)
    for face in faces:
        f_z = sum(v.co.z for v in face.verts) / len(face.verts)
        key = 0.16 + 0.78 * (f_z - z_min) / z_span
        tag(part, [face], row, key, smooth=False)


def _planter_box(part):
    bm = part.bm
    outer = [(-HALF, -0.40), (HALF, -0.40), (HALF, 0.40), (-HALF, 0.40)]
    inner = [(-1.88, -0.28), (1.88, -0.28), (1.88, 0.28), (-1.88, 0.28)]
    z_bot = 0.0
    z_mid = 0.24
    z_top = 0.36
    z_soil = 0.29
    vo_b = [bm.verts.new((x, y, z_bot)) for x, y in outer]
    vo_m = [bm.verts.new((x, y, z_mid)) for x, y in outer]
    vo_t = [bm.verts.new((x, y, z_top)) for x, y in outer]
    vi_t = [bm.verts.new((x, y, z_top)) for x, y in inner]
    vi_s = [bm.verts.new((x, y, z_soil)) for x, y in inner]

    wall_faces = []
    rim_faces = []
    for i in range(4):
        j = (i + 1) % 4
        wall_faces.append(bm.faces.new([vo_b[i], vo_b[j], vo_m[j], vo_m[i]]))
        rim_faces.append(bm.faces.new([vo_m[i], vo_m[j], vo_t[j], vo_t[i]]))
        rim_faces.append(bm.faces.new([vo_t[i], vo_t[j], vi_t[j], vi_t[i]]))
        rim_faces.append(bm.faces.new([vi_t[i], vi_t[j], vi_s[j], vi_s[i]]))
    bottom_face = bm.faces.new(list(reversed(vo_b)))
    soil_face = bm.faces.new(vi_s)
    wall_faces.append(bottom_face)
    all_faces = wall_faces + rim_faces + [soil_face]
    bmesh.ops.recalc_face_normals(bm, faces=all_faces)

    tag(part, wall_faces, 'wall')
    tag(part, rim_faces, 'top')
    tag(part, [soil_face], 'soft')

    bevel_top = [
        e
        for e in {edge for f in rim_faces for edge in f.edges}
        if all(v.co.z > z_top - 0.01 for v in e.verts)
    ]
    bevel_bot = [
        e
        for e in {edge for f in wall_faces for edge in f.edges}
        if e.calc_face_angle(0.0) > 0.5 and not all(v.co.z > z_mid - 0.01 for v in e.verts)
    ]
    before_top = set(bm.faces)
    _bevel_edges(part, bevel_top, 0.012, segments=1)
    for face in bm.faces:
        if face not in before_top:
            tag(part, [face], 'top')
    before_bot = set(bm.faces)
    _bevel_edges(part, bevel_bot, 0.014, segments=1)
    for face in bm.faces:
        if face not in before_bot:
            tag(part, [face], 'wall')


def build_median(variant):
    part = HeroPart(f'median_{variant}')
    if variant == 'a':
        rbox(part, (0.0, 0.0, 0.13), (CELL, 0.58, 0.26), 'wall', radius=0.018, segments=1)
        rbox(part, (0.0, 0.0, 0.285), (3.98, 0.46, 0.07), 'top', radius=0.012, segments=1)
        for rx in (-1.0, 1.0):
            rbox(part, (rx, 0.0, 0.16), (0.24, 0.60, 0.06), 'metal', radius=0.008, segments=1)
        return part

    _planter_box(part)
    lumps = [
        ((-1.56, -0.05, 0.37), (0.19, 0.16, 0.16), 11, 'foliage'),
        ((-1.36, 0.06, 0.42), (0.21, 0.18, 0.21), 17, 'grass'),
        ((-1.18, -0.07, 0.36), (0.17, 0.15, 0.15), 23, 'foliage'),
        ((-1.38, 0.01, 0.54), (0.15, 0.14, 0.16), 29, 'foliage'),
        ((-0.82, 0.07, 0.38), (0.19, 0.17, 0.17), 37, 'grass'),
        ((-0.62, -0.05, 0.44), (0.22, 0.18, 0.22), 41, 'foliage'),
        ((-0.44, 0.06, 0.35), (0.16, 0.15, 0.14), 47, 'foliage'),
        ((-0.60, 0.02, 0.58), (0.15, 0.13, 0.17), 53, 'grass'),
        ((-0.12, -0.04, 0.39), (0.20, 0.17, 0.18), 61, 'foliage'),
        ((0.08, 0.07, 0.43), (0.21, 0.17, 0.20), 67, 'grass'),
        ((0.22, -0.07, 0.36), (0.17, 0.14, 0.15), 71, 'foliage'),
        ((0.02, -0.01, 0.53), (0.15, 0.14, 0.15), 79, 'foliage'),
        ((0.54, 0.06, 0.38), (0.19, 0.16, 0.17), 83, 'grass'),
        ((0.74, -0.03, 0.45), (0.22, 0.18, 0.23), 89, 'foliage'),
        ((0.94, 0.07, 0.36), (0.17, 0.15, 0.15), 97, 'foliage'),
        ((0.73, 0.02, 0.60), (0.16, 0.14, 0.17), 103, 'grass'),
        ((1.24, -0.05, 0.39), (0.19, 0.16, 0.17), 109, 'foliage'),
        ((1.44, 0.05, 0.42), (0.21, 0.17, 0.20), 113, 'grass'),
        ((1.58, -0.04, 0.35), (0.16, 0.15, 0.14), 127, 'foliage'),
    ]
    for center, radii, seed, row in lumps:
        _shrub_lump(part, center, radii, seed, row)
    _triangulate_ngons(part.bm)
    return part


def _kerb_block(part, x0, x1, bevel_ends):
    outline = [(-1.00, 0.00), (-0.84, 0.00), (-0.818, 0.030), (-0.818, SIDEWALK_TOP), (-0.94, SIDEWALK_TOP)]
    bm = part.bm
    near = [bm.verts.new((x0, y, z)) for y, z in outline]
    far = [bm.verts.new((x1, y, z)) for y, z in outline]
    before = set(bm.faces)
    faces = [
        bm.faces.new(list(reversed(near))),
        bm.faces.new(far),
    ]
    count = len(outline)
    for i in range(count):
        j = (i + 1) % count
        faces.append(bm.faces.new([near[i], near[j], far[j], far[i]]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    bevel_edges = []
    for edge in {e for f in faces for e in f.edges}:
        on_top = any(v.co.z > SIDEWALK_TOP - 0.01 for v in edge.verts)
        on_end_cap = any(
            (x in bevel_ends) and all(abs(v.co.x - x) < 1e-4 for v in edge.verts)
            for x in bevel_ends
        )
        if on_top or (on_end_cap and any(v.co.z > 0.01 for v in edge.verts)):
            bevel_edges.append(edge)
    _bevel_edges(part, bevel_edges, 0.008, segments=1)
    created = [f for f in bm.faces if f not in before]
    tag(part, created, 'metal')


def _verge_deck(part):
    bm = part.bm
    xs = [-HALF, -1.0, 0.0, 1.0, HALF]
    ys = [-0.82, 0.09, 1.00]
    nx = len(xs)
    ny = len(ys)
    top = [[bm.verts.new((x, y, SIDEWALK_TOP)) for y in ys] for x in xs]
    top_faces = []
    for ix in range(nx - 1):
        for iy in range(ny - 1):
            face = bm.faces.new([top[ix][iy], top[ix + 1][iy], top[ix + 1][iy + 1], top[ix][iy + 1]])
            top_faces.append((face, 'floor' if (ix + iy) % 2 == 0 else 'top'))

    perim_top = (
        [top[ix][0] for ix in range(nx - 1)]
        + [top[nx - 1][iy] for iy in range(ny - 1)]
        + [top[ix][ny - 1] for ix in range(nx - 1, 0, -1)]
        + [top[0][iy] for iy in range(ny - 1, 0, -1)]
    )
    perim_bot = [bm.verts.new((v.co.x, v.co.y, 0.0)) for v in perim_top]
    side_faces = []
    count = len(perim_top)
    for i in range(count):
        j = (i + 1) % count
        side_faces.append(bm.faces.new([perim_top[i], perim_top[j], perim_bot[j], perim_bot[i]]))
    bottom_face = bm.faces.new(list(reversed(perim_bot)))
    all_deck = [f for f, _ in top_faces] + side_faces + [bottom_face]
    bmesh.ops.recalc_face_normals(bm, faces=all_deck)

    for face, row in top_faces:
        tag(part, [face], row)
    tag(part, side_faces + [bottom_face], 'top')

    perim_edges = [
        e
        for e in {edge for f, _ in top_faces for edge in f.edges}
        if e.calc_face_angle(0.0) > 0.5
        and all(v.co.z > SIDEWALK_TOP - 0.005 for v in e.verts)
    ]
    before = set(bm.faces)
    _bevel_edges(part, perim_edges, 0.012, segments=1)
    for face in bm.faces:
        if face not in before:
            tag(part, [face], 'top')


def build_verge():
    part = HeroPart('verge_a')
    _verge_deck(part)
    _kerb_block(part, -HALF, -1.003, bevel_ends=(-HALF,))
    _kerb_block(part, -0.997, -0.003, bevel_ends=())
    _kerb_block(part, 0.003, 0.997, bevel_ends=())
    _kerb_block(part, 1.003, HALF, bevel_ends=(HALF,))
    _triangulate_ngons(part.bm)
    return part


def _extrude_polygon(part, points, z0=MARK_BOTTOM, z1=MARK_TOP, row='metal'):
    bm = part.bm
    before = set(bm.faces)
    bot = [bm.verts.new((x, y, z0)) for x, y in points]
    top = [bm.verts.new((x, y, z1)) for x, y in points]
    f_top = bm.faces.new(top)
    f_bot = bm.faces.new(list(reversed(bot)))
    count = len(points)
    sides = []
    for i in range(count):
        j = (i + 1) % count
        sides.append(bm.faces.new([bot[i], bot[j], top[j], top[i]]))
    all_faces = [f_top, f_bot] + sides
    bmesh.ops.recalc_face_normals(bm, faces=all_faces)
    _triangulate_ngons(bm)
    created = [f for f in bm.faces if f not in before]
    tag(part, created, row)


def _extrude_ring(part, cx, cy, r_outer, r_inner, segments=10, z0=MARK_BOTTOM, z1=MARK_TOP, row='metal', phase=0.0):
    bm = part.bm
    out_bot = []
    out_top = []
    in_bot = []
    in_top = []
    for i in range(segments):
        a = 2 * pi * i / segments + phase
        ca, sa = cos(a), sin(a)
        out_bot.append(bm.verts.new((cx + r_outer * ca, cy + r_outer * sa, z0)))
        out_top.append(bm.verts.new((cx + r_outer * ca, cy + r_outer * sa, z1)))
        in_bot.append(bm.verts.new((cx + r_inner * ca, cy + r_inner * sa, z0)))
        in_top.append(bm.verts.new((cx + r_inner * ca, cy + r_inner * sa, z1)))
    faces = []
    for i in range(segments):
        j = (i + 1) % segments
        faces.append(bm.faces.new([in_top[i], out_top[i], out_top[j], in_top[j]]))
        faces.append(bm.faces.new([out_bot[i], in_bot[i], in_bot[j], out_bot[j]]))
        faces.append(bm.faces.new([out_bot[i], out_bot[j], out_top[j], out_top[i]]))
        faces.append(bm.faces.new([in_bot[j], in_bot[i], in_top[i], in_top[j]]))
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    tag(part, faces, row)


def build_mark(variant):
    part = HeroPart(f'mark_{variant}')
    if variant == 'a':
        _extrude_polygon(
            part,
            [
                (-1.30, -0.11),
                (0.45, -0.11),
                (0.45, -0.36),
                (1.30, 0.0),
                (0.45, 0.36),
                (0.45, 0.11),
                (-1.30, 0.11),
            ],
        )
        return part

    if variant == 'b':
        _extrude_polygon(
            part,
            [
                (-1.30, -0.11),
                (0.45, -0.11),
                (0.45, -0.34),
                (1.30, 0.0),
                (0.45, 0.34),
                (0.45, 0.11),
                (0.04, 0.11),
                (0.04, 0.42),
                (0.24, 0.42),
                (-0.08, 0.80),
                (-0.40, 0.42),
                (-0.20, 0.42),
                (-0.20, 0.11),
                (-1.30, 0.11),
            ],
        )
        return part

    if variant == 'c':
        rbox(part, (0.0, 0.0, 0.004), (0.40, 3.60, 0.004), 'metal', radius=0.001, segments=1)
        return part

    _extrude_ring(part, -0.62, -0.26, 0.26, 0.14, segments=10, phase=pi / 10)
    _extrude_ring(part, 0.64, -0.26, 0.26, 0.14, segments=10, phase=pi / 10)
    scooter_body = [
        (-0.92, 0.12),
        (-0.56, 0.06),
        (-0.489, -0.031),
        (-0.445, -0.064),
        (-0.24, -0.18),
        (0.24, -0.18),
        (0.34, 0.06),
        (0.50, 0.10),
        (0.59, 0.0025),
        (0.69, 0.0025),
        (0.59, 0.11),
        (0.76, 0.11),
        (0.56, 0.34),
        (0.44, 0.56),
        (0.22, 0.58),
        (0.20, 0.49),
        (0.35, 0.48),
        (0.30, 0.30),
        (0.18, -0.02),
        (-0.14, -0.02),
        (-0.24, 0.20),
        (-0.82, 0.26),
    ]
    _extrude_polygon(part, scooter_body)
    return part


def build_road_parts():
    return (
        build_lane('a'),
        build_lane('b'),
        build_lane('c'),
        build_median('a'),
        build_median('b'),
        build_verge(),
        build_mark('a'),
        build_mark('b'),
        build_mark('c'),
        build_mark('d'),
    )
