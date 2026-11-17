import math

import bmesh
from mathutils import Matrix, Vector

from hero_kit import HeroPart, rounded_rect

GLOW_KEY_RED = ('accent', 1.0)
GLOW_KEY_YELLOW = ('strip', 0.5)
GLOW_KEY_GREEN = ('keycap', 1.0)
GLOW_KEY_COUNTDOWN = ('screen', 0.5)
GLOW_KEY_LAMP = ('strip', 0.5)


def set_key_u(part, key_u):
    for face in part.bm.faces:
        face[part.key_layer] = key_u


def box(part, center, size, row):
    cx, cy, cz = center
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    verts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    faces = [
        [0, 3, 2, 1],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [2, 3, 7, 6],
        [0, 4, 7, 3],
        [1, 2, 6, 5],
    ]
    part.add_cage(verts, faces, [row] * 6, levels=0, smooth=False)


def xform_box(part, xform, local_center, size, row):
    cx, cy, cz = local_center
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    local_verts = [
        Vector((cx - hx, cy - hy, cz - hz)),
        Vector((cx + hx, cy - hy, cz - hz)),
        Vector((cx + hx, cy + hy, cz - hz)),
        Vector((cx - hx, cy + hy, cz - hz)),
        Vector((cx - hx, cy - hy, cz + hz)),
        Vector((cx + hx, cy - hy, cz + hz)),
        Vector((cx + hx, cy + hy, cz + hz)),
        Vector((cx - hx, cy + hy, cz + hz)),
    ]
    verts = [tuple(xform @ v) for v in local_verts]
    faces = [
        [0, 3, 2, 1],
        [4, 5, 6, 7],
        [0, 1, 5, 4],
        [2, 3, 7, 6],
        [0, 4, 7, 3],
        [1, 2, 6, 5],
    ]
    part.add_cage(verts, faces, [row] * 6, levels=0, smooth=False)


def xform_rounded_box(part, xform, local_center, size, row, radius=0.008):
    bm_tmp = bmesh.new()
    geom = bmesh.ops.create_cube(bm_tmp, size=1.0)
    for v in geom['verts']:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    edges = list({e for v in geom['verts'] for e in v.link_edges})
    bmesh.ops.bevel(bm_tmp, geom=edges, offset=radius, segments=1, affect='EDGES', profile=0.5)
    offset = Vector(local_center)
    for v in bm_tmp.verts:
        v.co = xform @ (v.co + offset)
    bm_tmp.verts.index_update()
    verts = [tuple(v.co) for v in bm_tmp.verts]
    faces = [[v.index for v in f.verts] for f in bm_tmp.faces]
    bm_tmp.free()
    part.add_cage(verts, faces, [row] * len(faces), levels=0, smooth=False)


def anchor_bolts(part, cx, cy, z_top, spread_x, spread_y, row='metal'):
    for sx in (-1, 1):
        for sy in (-1, 1):
            bx = cx + sx * spread_x
            by = cy + sy * spread_y
            part.revolve(
                (bx, by, z_top - 0.005),
                'z',
                [(0.015, 0.0, row), (0.015, 0.025, row)],
                segments=6,
                smooth=False,
            )


def base_flange(part, cx, cy, width, depth, height=0.03, z_base=0.0, row='metal'):
    part.rounded_box((cx, cy, z_base + height * 0.5), (width, depth, height), row, radius=0.006, segments=1)
    anchor_bolts(part, cx, cy, z_base + height, width * 0.36, depth * 0.36, row)


def hand_hole_door(part, radius, z_center, row_frame='metal', row_door='body'):
    y_front = -radius + 0.004
    box(part, (0.0, y_front - 0.005, z_center), (0.11, 0.026, 0.24), row_frame)
    box(part, (0.0, y_front - 0.016, z_center), (0.082, 0.014, 0.205), row_door)
    box(part, (0.025, y_front - 0.022, z_center), (0.014, 0.016, 0.036), row_frame)


def sweep_arm(part, points, radii, side_axis, row, sides=8, cap=True):
    rings = []
    side_vec = Vector(side_axis).normalized()
    count = len(points)
    for i, (pt, rad) in enumerate(zip(points, radii)):
        p = Vector(pt)
        tangent = (Vector(points[min(i + 1, count - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        up_vec = side_vec.cross(tangent).normalized()
        s_vec = up_vec.cross(tangent).normalized()
        rings.append([
            p + (s_vec * math.cos(2 * math.pi * k / sides) + up_vec * math.sin(2 * math.pi * k / sides)) * rad
            for k in range(sides)
        ])
    part.loft(rings, lambda r, c: row, levels=0, closed=True, cap=cap, smooth=True)


def add_visor(part, cx, y_face, cz, radius, depth=0.14, thick=0.012, steps=10, row='body'):
    start_deg = -10.0
    end_deg = 190.0
    outer_r = radius + thick
    inner_r = radius
    front_y = y_face - depth
    back_y = y_face + 0.008
    rings = []
    for i in range(steps + 1):
        a = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        ca, sa = math.cos(a), math.sin(a)
        rings.append([
            Vector((cx + inner_r * ca, back_y, cz + inner_r * sa)),
            Vector((cx + inner_r * ca, front_y, cz + inner_r * sa)),
            Vector((cx + outer_r * ca, front_y, cz + outer_r * sa)),
            Vector((cx + outer_r * ca, back_y, cz + outer_r * sa)),
        ])
    part.loft(rings, lambda r, c: row, levels=0, closed=True, cap=True, smooth=True)


def build_bulb(name, cx, y_face, cz, radius, row_spec):
    bulb = HeroPart(name)
    row, key_u = row_spec
    bulb.revolve(
        (cx, y_face, cz),
        'y',
        [
            (0.004, -0.016, row),
            (radius * 0.72, -0.013, row),
            (radius, -0.005, row),
            (radius, 0.005, row),
            (0.004, 0.005, row),
        ],
        segments=12,
        smooth=True,
    )
    set_key_u(bulb, key_u)
    return bulb


def build_signal():
    signal = HeroPart('signal_a')
    base_flange(signal, 0.0, 0.0, 0.42, 0.42, 0.032, 0.0, 'metal')
    signal.revolve(
        (0.0, 0.0, 0.024),
        'z',
        [
            (0.115, 0.0, 'metal'),
            (0.11, 0.35, 'metal'),
            (0.095, 2.5, 'metal'),
            (0.08, 5.45, 'metal'),
            (0.085, 5.48, 'metal'),
            (0.004, 5.54, 'metal'),
        ],
        segments=8,
        smooth=True,
    )
    hand_hole_door(signal, 0.105, 0.55)
    signal.rounded_box((-0.14, 0.0, 1.55), (0.14, 0.22, 0.32), 'metal', radius=0.012, segments=1)
    box(signal, (-0.21, 0.0, 1.55), (0.014, 0.18, 0.26), 'metal')
    signal.tube([(-0.14, 0.0, 1.68), (-0.14, 0.0, 5.18), (-0.06, 0.0, 5.26)], 0.016, 'body', sides=4)

    box(signal, (0.04, 0.0, 5.22), (0.22, 0.22, 0.22), 'metal')
    gusset_front = [Vector((0.04, -0.022, 4.80)), Vector((0.04, -0.022, 5.20)), Vector((0.46, -0.022, 5.20))]
    gusset_back = [Vector((0.04, 0.022, 4.80)), Vector((0.04, 0.022, 5.20)), Vector((0.46, 0.022, 5.20))]
    signal.loft([gusset_front, gusset_back], lambda r, c: 'metal', levels=0, closed=True, cap=True, smooth=False)
    sweep_arm(
        signal,
        [(0.04, 0.0, 5.22), (0.8, 0.0, 5.26), (1.8, 0.0, 5.31), (2.98, 0.0, 5.35)],
        [0.085, 0.075, 0.064, 0.052],
        (0.0, 1.0, 0.0),
        'metal',
        sides=6,
    )

    head_x = 1.95
    head_y = -0.02
    head_z = 4.54
    box(signal, (head_x, 0.0, 5.31), (0.12, 0.16, 0.16), 'metal')
    box(signal, (head_x, head_y, 5.12), (0.08, 0.08, 0.30), 'metal')

    box(signal, (head_x, head_y + 0.09, head_z), (0.48, 0.028, 1.06), 'body')
    box(signal, (head_x, head_y + 0.075, head_z), (0.50, 0.012, 1.08), 'trim')
    signal.rounded_box((head_x, head_y - 0.01, head_z), (0.34, 0.21, 0.94), 'body', radius=0.016, segments=1)

    lens_y = head_y - 0.115
    bulb_zs = (4.84, 4.54, 4.24)
    for bz in bulb_zs:
        box(signal, (head_x, lens_y + 0.004, bz), (0.24, 0.016, 0.24), 'soft')
        add_visor(signal, head_x, lens_y - 0.004, bz, 0.102, depth=0.14, thick=0.012, steps=10, row='body')

    cd_x = 2.58
    cd_z = 4.68
    box(signal, (cd_x, 0.0, 5.33), (0.11, 0.15, 0.15), 'metal')
    box(signal, (cd_x, head_y, 5.11), (0.07, 0.07, 0.36), 'metal')
    signal.rounded_box((cd_x, head_y - 0.01, cd_z), (0.32, 0.19, 0.44), 'body', radius=0.014, segments=1)
    box(signal, (cd_x, head_y - 0.08, cd_z + 0.215), (0.34, 0.16, 0.02), 'body')
    box(signal, (cd_x, lens_y + 0.014, cd_z), (0.26, 0.014, 0.36), 'soft')

    bulb_red = build_bulb('signal_a_bulb_red', head_x, lens_y, bulb_zs[0], 0.086, GLOW_KEY_RED)
    bulb_yellow = build_bulb('signal_a_bulb_yellow', head_x, lens_y, bulb_zs[1], 0.086, GLOW_KEY_YELLOW)
    bulb_green = build_bulb('signal_a_bulb_green', head_x, lens_y, bulb_zs[2], 0.086, GLOW_KEY_GREEN)

    countdown = HeroPart('signal_a_countdown')
    box(countdown, (cd_x, lens_y + 0.008, cd_z), (0.22, 0.016, 0.31), GLOW_KEY_COUNTDOWN[0])
    set_key_u(countdown, GLOW_KEY_COUNTDOWN[1])

    return signal, [bulb_red, bulb_yellow, bulb_green, countdown]


def add_walk_figure_stop(part, y_back, z_center, row):
    y_torso = y_back - 0.003
    y_limb = y_back - 0.001
    part.revolve(
        (0.0, y_back + 0.003, z_center + 0.072),
        'y',
        [(0.021, -0.012, row), (0.021, 0.004, row)],
        segments=8,
        smooth=False,
    )
    box(part, (0.0, y_torso, z_center + 0.018), (0.044, 0.016, 0.068), row)
    for side in (-1, 1):
        box(part, (side * 0.032, y_limb, z_center + 0.014), (0.016, 0.012, 0.064), row)
        box(part, (side * 0.014, y_limb, z_center - 0.046), (0.017, 0.012, 0.072), row)


def tilted_bar(part, x0, z0, x1, z1, half_w, y0, y1, row):
    dx = x1 - x0
    dz = z1 - z0
    length = math.hypot(dx, dz)
    nx, nz = -dz / length * half_w, dx / length * half_w
    front = [
        Vector((x0 - nx, y0, z0 - nz)),
        Vector((x0 + nx, y0, z0 + nz)),
        Vector((x1 + nx, y0, z1 + nz)),
        Vector((x1 - nx, y0, z1 - nz)),
    ]
    back = [Vector((p.x, y1, p.z)) for p in front]
    part.loft([front, back], lambda r, c: row, levels=0, closed=True, cap=True, smooth=False)


def add_walk_figure_go(part, y_back, z_center, row):
    y_torso = y_back - 0.003
    part.revolve(
        (0.006, y_back + 0.003, z_center + 0.072),
        'y',
        [(0.021, -0.012, row), (0.021, 0.004, row)],
        segments=8,
        smooth=False,
    )
    tilted_bar(part, -0.004, z_center - 0.012, 0.008, z_center + 0.048, 0.021, y_torso - 0.007, y_back + 0.009, row)
    tilted_bar(part, 0.002, z_center + 0.038, -0.034, z_center - 0.004, 0.008, y_back - 0.005, y_back + 0.004, row)
    tilted_bar(part, 0.008, z_center + 0.038, 0.044, z_center + 0.002, 0.008, y_back - 0.007, y_back + 0.006, row)
    tilted_bar(part, -0.006, z_center - 0.008, -0.036, z_center - 0.078, 0.009, y_back - 0.004, y_back + 0.005, row)
    tilted_bar(part, 0.002, z_center - 0.008, 0.036, z_center - 0.076, 0.009, y_back - 0.008, y_back + 0.007, row)


def build_walk():
    walk = HeroPart('walk_a')
    base_flange(walk, 0.0, 0.0, 0.28, 0.28, 0.026, 0.0, 'metal')
    walk.revolve(
        (0.0, 0.0, 0.02),
        'z',
        [
            (0.068, 0.0, 'metal'),
            (0.064, 0.25, 'metal'),
            (0.056, 2.48, 'metal'),
            (0.06, 2.51, 'metal'),
            (0.004, 2.55, 'metal'),
        ],
        segments=8,
        smooth=True,
    )
    hand_hole_door(walk, 0.062, 0.36)

    walk.rounded_box((0.0, -0.085, 1.05), (0.09, 0.06, 0.16), 'metal', radius=0.01, segments=1)
    walk.revolve(
        (0.0, -0.112, 1.03),
        'y',
        [(0.022, -0.014, 'metal'), (0.022, 0.006, 'metal')],
        segments=8,
        smooth=False,
    )
    box(walk, (0.0, -0.115, 1.09), (0.04, 0.01, 0.016), 'strip')

    head_y = -0.12
    for cz in (1.92, 2.42):
        box(walk, (0.0, -0.055, cz), (0.14, 0.14, 0.04), 'metal')
    walk.rounded_box((0.0, head_y, 2.17), (0.31, 0.19, 0.62), 'body', radius=0.016, segments=1)
    box(walk, (0.0, head_y - 0.01, 2.17), (0.33, 0.016, 0.64), 'trim')

    lens_y = head_y - 0.095
    bay_zs = (2.32, 2.02)
    for bz in bay_zs:
        box(walk, (0.0, lens_y + 0.004, bz), (0.23, 0.016, 0.23), 'soft')
        add_visor(walk, 0.0, lens_y - 0.004, bz, 0.102, depth=0.13, thick=0.011, steps=10, row='body')

    stop_fig = HeroPart('walk_a_stop')
    add_walk_figure_stop(stop_fig, lens_y - 0.002, bay_zs[0], GLOW_KEY_RED[0])
    set_key_u(stop_fig, GLOW_KEY_RED[1])

    go_fig = HeroPart('walk_a_go')
    add_walk_figure_go(go_fig, lens_y - 0.002, bay_zs[1], GLOW_KEY_GREEN[0])
    set_key_u(go_fig, GLOW_KEY_GREEN[1])

    return walk, [stop_fig, go_fig]


def sign_pole_assembly(part, top_z=2.55, clamp_zs=(2.05, 2.35), rail_w=0.46):
    base_flange(part, 0.0, 0.0, 0.24, 0.24, 0.024, 0.0, 'metal')
    part.revolve(
        (0.0, 0.0, 0.018),
        'z',
        [(0.042, 0.0, 'metal'), (0.038, top_z - 0.04, 'metal'), (0.043, top_z - 0.02, 'metal'), (0.004, top_z, 'metal')],
        segments=8,
        smooth=True,
    )
    for cz in clamp_zs:
        part.revolve(
            (0.0, 0.0, cz),
            'z',
            [(0.048, -0.018, 'metal'), (0.048, 0.018, 'metal')],
            segments=8,
            smooth=False,
        )
        box(part, (0.0, -0.052, cz), (rail_w, 0.024, 0.028), 'metal')


def make_hollow_frame(part, outer_pts, inner_pts, y_front, y_back, row):
    n = len(outer_pts)
    verts = []
    for (ox, oz), (ix, iz) in zip(outer_pts, inner_pts):
        verts.extend([
            (ox, y_back, oz),
            (ix, y_back, iz),
            (ix, y_front, iz),
            (ox, y_front, oz),
        ])
    faces = []
    for r in range(n):
        rn = (r + 1) % n
        b0, b1 = r * 4, rn * 4
        for c in range(4):
            cn = (c + 1) % 4
            faces.append([b0 + c, b0 + cn, b1 + cn, b1 + c])
    part.add_cage(verts, faces, [row] * len(faces), levels=0, smooth=False)


def circle_xz_pts(cx, cz, radius, segments):
    return [(cx + radius * math.cos(2 * math.pi * i / segments), cz + radius * math.sin(2 * math.pi * i / segments)) for i in range(segments)]


def build_roadsign_round():
    sign = HeroPart('roadsign_a')
    sign_pole_assembly(sign, top_z=2.52, clamp_zs=(2.04, 2.34), rail_w=0.44)
    cz = 2.19
    face_y = -0.072
    sign.revolve(
        (0.0, face_y, cz),
        'y',
        [(0.34, 0.0, 'metal'), (0.34, 0.016, 'metal')],
        segments=18,
        smooth=True,
    )
    outer_rim = circle_xz_pts(0.0, cz, 0.344, 18)
    inner_rim = circle_xz_pts(0.0, cz, 0.296, 18)
    make_hollow_frame(sign, outer_rim, inner_rim, face_y - 0.015, face_y + 0.004, 'metal')
    sign.revolve(
        (0.0, face_y, cz),
        'y',
        [(0.294, -0.008, 'soft'), (0.294, 0.006, 'soft')],
        segments=16,
        smooth=False,
    )
    decal_pts = [(x, face_y - 0.011, z) for x, z in circle_xz_pts(0.0, cz, 0.284, 16)]
    sign.image_quad(list(reversed(decal_pts)), 'decal')
    return sign


def triangle_ring_xz(cx, cz, radius, corner_r, steps=2):
    corners = [
        (cx, cz + radius),
        (cx + radius * math.cos(math.radians(210)), cz + radius * math.sin(math.radians(210))),
        (cx + radius * math.cos(math.radians(330)), cz + radius * math.sin(math.radians(330))),
    ]
    angles = [(30, 150), (150, 270), (270, 390)]
    pts = []
    for (ox, oz), (a0, a1) in zip(corners, angles):
        for i in range(steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / steps)
            pts.append((ox + corner_r * math.cos(a), oz + corner_r * math.sin(a)))
    return pts


def build_roadsign_triangle():
    sign = HeroPart('roadsign_b')
    sign_pole_assembly(sign, top_z=2.52, clamp_zs=(2.05, 2.28), rail_w=0.40)
    cz = 2.15
    face_y = -0.072
    back_xz = triangle_ring_xz(0.0, cz, 0.34, 0.045, steps=2)
    back_front = [Vector((x, face_y, z)) for x, z in back_xz]
    back_rear = [Vector((x, face_y + 0.016, z)) for x, z in back_xz]
    sign.loft([back_rear, back_front], lambda r, c: 'metal', levels=0, closed=True, cap=True, smooth=False)

    outer_xz = triangle_ring_xz(0.0, cz, 0.344, 0.045, steps=2)
    inner_xz = triangle_ring_xz(0.0, cz, 0.276, 0.032, steps=2)
    make_hollow_frame(sign, outer_xz, inner_xz, face_y - 0.015, face_y + 0.004, 'metal')

    soft_xz = triangle_ring_xz(0.0, cz, 0.284, 0.034, steps=2)
    soft_front = [Vector((x, face_y - 0.008, z)) for x, z in soft_xz]
    soft_rear = [Vector((x, face_y + 0.006, z)) for x, z in soft_xz]
    sign.loft([soft_rear, soft_front], lambda r, c: 'soft', levels=0, closed=True, cap=True, smooth=False)

    decal_pts = [(x, face_y - 0.011, z) for x, z in triangle_ring_xz(0.0, cz, 0.264, 0.03, steps=2)]
    sign.image_quad(list(reversed(decal_pts)), 'decal')
    return sign


def build_roadsign_rect():
    sign = HeroPart('roadsign_c')
    sign_pole_assembly(sign, top_z=2.52, clamp_zs=(2.04, 2.34), rail_w=0.52)
    cz = 2.19
    face_y = -0.072
    sign.slab_y(
        0.0,
        cz,
        0.36,
        0.25,
        0.035,
        [
            (face_y, 0.0, 'metal'),
            (face_y + 0.016, 0.004, 'metal'),
        ],
        corner=2,
    )
    outer_xz = rounded_rect(0.0, cz, 0.364, 0.254, 0.036, 2)
    inner_xz = rounded_rect(0.0, cz, 0.322, 0.212, 0.020, 2)
    make_hollow_frame(sign, outer_xz, inner_xz, face_y - 0.015, face_y + 0.004, 'metal')
    sign.slab_y(
        0.0,
        cz,
        0.320,
        0.210,
        0.02,
        [
            (face_y - 0.008, 0.0, 'soft'),
            (face_y + 0.006, 0.0, 'soft'),
        ],
        corner=2,
    )
    hw, hh = 0.310, 0.200
    decal_y = face_y - 0.011
    sign.image_rect(
        [(-hw, decal_y, cz - hh), (hw, decal_y, cz - hh), (hw, decal_y, cz + hh), (-hw, decal_y, cz + hh)],
        'decal',
        (0.0, 0.0, 1.0, 1.0),
    )
    return sign


def led_luminaire_head(part, cx, cy, cz, yaw=0.0, tilt_deg=8.0):
    rot_z = Matrix.Rotation(yaw, 4, 'Z')
    tilt = Matrix.Rotation(math.radians(tilt_deg), 4, 'X')
    xform = Matrix.Translation(Vector((cx, cy, cz))) @ rot_z @ tilt

    hw, hd, hh = 0.16, 0.34, 0.042
    layers = [
        (-hh, 0.016, 'body'),
        (-hh + 0.012, 0.0, 'metal'),
        (hh - 0.012, 0.0, 'metal'),
        (hh, 0.018, 'metal'),
    ]
    rings = []
    for z, inset, _ in layers:
        pts = rounded_rect(0.0, 0.0, hw - inset, hd - inset, max(0.03 - inset, 0.004), 2)
        rings.append([xform @ Vector((x, y, z)) for x, y in pts])
    part.loft(rings, lambda r, c: layers[r][2], levels=0, smooth=False)

    for fx in (-0.09, -0.03, 0.03, 0.09):
        xform_box(part, xform, (fx, 0.0, hh + 0.006), (0.016, 0.44, 0.020), 'body')

    glow_z = -hh - 0.003
    gw, gd = 0.11, 0.25
    glow_pts = [tuple(xform @ Vector(p)) for p in [(-gw, -gd, glow_z), (gw, -gd, glow_z), (gw, gd, glow_z), (-gw, gd, glow_z)]]
    part.oriented_poly(glow_pts, tuple(rot_z @ tilt @ Vector((0, 0, -1))), GLOW_KEY_LAMP[0])
    part.bm.faces.ensure_lookup_table()
    part.bm.faces[-1][part.key_layer] = GLOW_KEY_LAMP[1]


def build_streetlight_single():
    lamp = HeroPart('streetlight_a')
    base_flange(lamp, 0.0, 0.0, 0.42, 0.42, 0.032, 0.0, 'metal')
    lamp.revolve(
        (0.0, 0.0, 0.025),
        'z',
        [
            (0.12, 0.0, 'metal'),
            (0.112, 0.7, 'metal'),
            (0.088, 4.5, 'metal'),
            (0.066, 8.65, 'metal'),
            (0.072, 8.70, 'metal'),
            (0.004, 8.78, 'metal'),
        ],
        segments=8,
        smooth=True,
    )
    hand_hole_door(lamp, 0.115, 0.55)
    box(lamp, (0.0, 0.0, 8.2), (0.18, 0.18, 0.14), 'metal')
    lamp.tube([(0.0, -0.05, 7.90), (0.0, -0.58, 8.70)], 0.024, 'metal', sides=4)
    sweep_arm(
        lamp,
        [(0.0, 0.0, 8.2), (0.0, -0.35, 8.58), (0.0, -0.95, 8.92), (0.0, -1.65, 9.04), (0.0, -1.92, 9.02)],
        [0.052, 0.048, 0.044, 0.038, 0.034],
        (1.0, 0.0, 0.0),
        'metal',
        sides=6,
    )
    led_luminaire_head(lamp, 0.0, -2.06, 8.98, yaw=0.0, tilt_deg=-8.0)
    return lamp


def build_streetlight_double():
    lamp = HeroPart('streetlight_b')
    base_flange(lamp, 0.0, 0.0, 0.44, 0.44, 0.032, 0.0, 'metal')
    lamp.revolve(
        (0.0, 0.0, 0.025),
        'z',
        [
            (0.125, 0.0, 'metal'),
            (0.115, 0.7, 'metal'),
            (0.09, 4.5, 'metal'),
            (0.068, 8.65, 'metal'),
            (0.075, 8.72, 'metal'),
            (0.004, 8.82, 'metal'),
        ],
        segments=8,
        smooth=True,
    )
    hand_hole_door(lamp, 0.118, 0.55)
    box(lamp, (0.0, 0.0, 8.2), (0.20, 0.20, 0.16), 'metal')
    for side in (-1, 1):
        lamp.tube([(side * 0.05, 0.0, 7.90), (side * 0.55, 0.0, 8.70)], 0.022, 'metal', sides=4)
        sweep_arm(
            lamp,
            [(side * 0.04, 0.0, 8.2), (side * 0.35, 0.0, 8.58), (side * 0.9, 0.0, 8.9), (side * 1.5, 0.0, 9.02), (side * 1.75, 0.0, 9.0)],
            [0.05, 0.046, 0.042, 0.036, 0.032],
            (0.0, 1.0, 0.0),
            'metal',
            sides=6,
        )
        led_luminaire_head(lamp, side * 1.88, 0.0, 8.96, yaw=side * math.pi / 2, tilt_deg=-8.0)
    return lamp


def add_camera_pod(part, cx, cy, cz, yaw_deg=0.0, pitch_deg=-14.0):
    xform = Matrix.Translation(Vector((cx, cy, cz))) @ Matrix.Rotation(math.radians(yaw_deg), 4, 'Z') @ Matrix.Rotation(math.radians(pitch_deg), 4, 'X')
    xform_rounded_box(part, xform, (0.0, 0.0, 0.0), (0.14, 0.28, 0.13), 'body', radius=0.01)
    xform_box(part, xform, (0.0, -0.02, 0.072), (0.16, 0.34, 0.024), 'metal')
    xform_box(part, xform, (0.0, -0.145, 0.0), (0.11, 0.024, 0.10), 'metal')
    xform_box(part, xform, (0.0, -0.158, 0.0), (0.072, 0.016, 0.072), 'soft')
    xform_box(part, xform, (0.0, -0.167, 0.02), (0.045, 0.008, 0.025), 'screen')
    xform_box(part, xform, (0.0, 0.125, -0.07), (0.06, 0.06, 0.08), 'metal')


def build_camera():
    cam = HeroPart('camera_a')
    cam.rounded_box((0.12, 0.0, 0.06), (0.76, 0.44, 0.12), 'top', radius=0.015, segments=1)
    base_flange(cam, -0.12, 0.0, 0.30, 0.30, 0.028, 0.115, 'metal')
    cam.revolve(
        (-0.12, 0.0, 0.135),
        'z',
        [
            (0.088, 0.0, 'metal'),
            (0.082, 0.5, 'metal'),
            (0.062, 4.9, 'metal'),
            (0.068, 4.94, 'metal'),
            (0.004, 5.02, 'metal'),
        ],
        segments=8,
        smooth=True,
    )

    cab_x = 0.25
    cam.rounded_box((cab_x, 0.0, 0.66), (0.38, 0.28, 1.12), 'metal', radius=0.014, segments=1)
    cam.rounded_box((cab_x, -0.02, 1.23), (0.42, 0.34, 0.04), 'metal', radius=0.008, segments=1)
    box(cam, (cab_x, -0.142, 0.66), (0.32, 0.018, 0.98), 'body')
    for lz in (0.32, 0.36, 0.40, 0.92, 0.96):
        box(cam, (cab_x, -0.154, lz), (0.22, 0.010, 0.016), 'metal')
    box(cam, (cab_x - 0.12, -0.156, 0.66), (0.024, 0.014, 0.11), 'metal')
    box(cam, (cab_x + 0.11, -0.155, 1.06), (0.04, 0.014, 0.018), 'accent')

    cam.tube([(cab_x, 0.0, 1.2), (0.08, 0.0, 1.38), (-0.04, 0.0, 1.52), (-0.04, 0.0, 4.78)], 0.018, 'body', sides=4)
    box(cam, (-0.12, 0.0, 4.65), (0.16, 0.18, 0.22), 'metal')
    box(cam, (-0.12, -0.04, 4.84), (0.86, 0.07, 0.07), 'metal')

    for cx, yaw in ((-0.44, 12.0), (0.20, -10.0)):
        box(cam, (cx, -0.06, 4.91), (0.06, 0.06, 0.11), 'metal')
        add_camera_pod(cam, cx, -0.10, 4.98, yaw_deg=yaw, pitch_deg=-12.0)

    return cam
