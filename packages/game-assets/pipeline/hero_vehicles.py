import math

import bmesh
from mathutils import Vector

from hero_kit import ALL_ROWS, HeroPart


def paint_from(part, before_faces, key_u, row='trim'):
    row_index = ALL_ROWS.index(row)
    for face in part.bm.faces:
        if face not in before_faces and face[part.row_layer] == row_index and face[part.key_layer] < 0:
            face[part.key_layer] = key_u


def box(part, center, size, row):
    cx, cy, cz = center
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    before = set(part.bm.faces)
    geom = bmesh.ops.create_cube(part.bm, size=1.0)
    for v in geom['verts']:
        v.co = Vector((cx + v.co.x * hx * 2.0, cy + v.co.y * hy * 2.0, cz + v.co.z * hz * 2.0))
    created = [f for f in part.bm.faces if f not in before]
    part._tag(created, row)
    return created


def finalize_keys(part, defaults):
    bmesh.ops.remove_doubles(part.bm, verts=part.bm.verts, dist=1e-5)
    for face in part.bm.faces:
        if face[part.key_layer] < 0:
            row_name = ALL_ROWS[face[part.row_layer]]
            face[part.key_layer] = defaults.get(row_name, 0.5)
    bmesh.ops.recalc_face_normals(part.bm, faces=part.bm.faces)


def revolve_torus(part, center, profile, segments=14, smooth=True):
    cx, cy, cz = center
    p_count = len(profile)
    verts = []
    faces = []
    rows = []
    for r, along, _ in profile:
        for s in range(segments):
            a = 2.0 * math.pi * s / segments
            verts.append((cx + along, cy + r * math.cos(a), cz + r * math.sin(a)))
    for p in range(p_count):
        np = (p + 1) % p_count
        row = profile[p][2]
        for s in range(segments):
            ns = (s + 1) % segments
            faces.append([p * segments + s, np * segments + s, np * segments + ns, p * segments + ns])
            rows.append(row)
    part.add_cage(verts, faces, rows, levels=0, smooth=smooth)


def build_wheel(name, radius, half_width, rim_ratio, hub_row='trim', hub_key=0.5, spokes=5, hub_segments=8):
    wheel = HeroPart(name)
    r_rim = radius * rim_ratio
    r_shoulder = radius * 0.962
    hw = half_width
    r_hub = max(0.032, r_rim * 0.25)

    revolve_torus(
        wheel,
        (0, 0, 0),
        [
            (r_rim * 0.84, -hw * 0.52, 'ceiling'),
            (r_rim * 0.98, -hw * 0.85, 'metal'),
            (r_shoulder, -hw * 0.98, 'ceiling'),
            (radius, -hw * 0.66, 'ceiling'),
            (radius, hw * 0.66, 'ceiling'),
            (r_shoulder, hw * 0.98, 'ceiling'),
            (r_rim * 0.98, hw * 0.85, 'metal'),
            (r_rim * 0.84, hw * 0.52, 'ceiling'),
        ],
        segments=12,
        smooth=True,
    )

    before = set(wheel.bm.faces)
    wheel.revolve(
        (0, 0, 0),
        'x',
        [
            (0.008, -hw * 0.82, hub_row),
            (r_hub, -hw * 0.74, 'metal'),
            (r_hub, hw * 0.74, 'metal'),
            (r_hub * 0.70, hw * 0.78, hub_row),
            (0.008, hw * 0.82, hub_row),
        ],
        segments=hub_segments,
        smooth=False,
    )
    paint_from(wheel, before, hub_key, hub_row)

    spoke_r0 = r_hub * 0.78
    spoke_r1 = r_rim * 0.89
    w0 = 0.022 if radius > 0.28 else 0.012
    w1 = w0 * 0.68
    for i in range(spokes):
        angle = 2.0 * math.pi * i / spokes
        dy = math.cos(angle)
        dz = math.sin(angle)
        sy = -dz
        sz = dy
        p0 = (spoke_r0 * dy - sy * w0, spoke_r0 * dz - sz * w0)
        p1 = (spoke_r0 * dy + sy * w0, spoke_r0 * dz + sz * w0)
        p2 = (spoke_r1 * dy + sy * w1, spoke_r1 * dz + sz * w1)
        p3 = (spoke_r1 * dy - sy * w1, spoke_r1 * dz - sz * w1)
        wheel.prism_x([p0, p1, p2, p3], -hw * 0.66, hw * 0.66, 'metal')

    finalize_keys(wheel, {'metal': 0.5, 'ceiling': 0.5, hub_row: hub_key})
    return wheel


def mirror_assembly(part, x_sign, base_x, base_y, base_z, paint_key):
    sx = x_sign
    part.tube([(sx * (base_x - 0.025), base_y, base_z), (sx * (base_x + 0.08), base_y + 0.03, base_z + 0.038)], 0.012, 'ceiling', sides=4)
    before = set(part.bm.faces)
    box(part, (sx * (base_x + 0.11), base_y + 0.048, base_z + 0.044), (0.115, 0.056, 0.072), 'trim')
    paint_from(part, before, paint_key)
    box(part, (sx * (base_x + 0.11), base_y + 0.068, base_z + 0.044), (0.095, 0.028, 0.054), 'ceiling')


def license_plate(part, y_pos, z_pos, facing, width=0.34, height=0.085):
    box(part, (0, y_pos - facing * 0.008, z_pos), (width + 0.022, 0.036, height + 0.018), 'ceiling')
    box(part, (0, y_pos + facing * 0.008, z_pos), (width, 0.022, height), 'top')


def arch_height(dy, r_arch, z_hub, z_sill):
    if abs(dy) >= r_arch:
        return z_sill
    return max(z_sill, z_hub + math.sqrt(max(0.0, r_arch * r_arch - dy * dy)))


def car_ring(st, x_well, z_under):
    yb = st['yb']
    ym = st['ym']
    yu = st['yu']
    yt = st['yt']
    za = st['za']
    zf = st['zf']
    zb = st['zb']
    zs = st['zs']
    zt = st['zt']
    zc = st['zc']
    xl = st['xl']
    xf = st['xf']
    xb = st['xb']
    xs = st['xs']
    xt = st['xt']
    return [
        Vector((0.0, yb, z_under)),
        Vector((-x_well, yb, z_under)),
        Vector((-x_well, yb, za)),
        Vector((-xl, yb, za)),
        Vector((-xf, ym, zf)),
        Vector((-xb, yu, zb)),
        Vector((-xs, yu, zs)),
        Vector((-xt, yt, zt)),
        Vector((0.0, yt, zc)),
        Vector((xt, yt, zt)),
        Vector((xs, yu, zs)),
        Vector((xb, yu, zb)),
        Vector((xf, ym, zf)),
        Vector((xl, yb, za)),
        Vector((x_well, yb, za)),
        Vector((x_well, yb, z_under)),
    ]


def build_car_shell(part, stations, x_well, z_under, paint_key, arch_rings, pillar_rings, dark_rings):
    rings = [car_ring(st, x_well, z_under) for st in stations]

    def row_of(r, c):
        if c in (0, 1, 14, 15):
            return 'floor'
        if c in (2, 3, 12, 13):
            return 'ceiling'
        if r in dark_rings:
            return 'ceiling'
        if r in pillar_rings and c in (6, 9):
            return 'ceiling'
        return 'trim'

    before = set(part.bm.faces)
    part.loft(rings, row_of, levels=0, closed=True, cap=True, smooth=True)
    paint_from(part, before, paint_key)
    bmesh.ops.recalc_face_normals(part.bm, faces=part.bm.faces)


def recess_car_features(part, side_win_bounds, front_win_y, rear_win_y, seam_y_bands, z_belt_min):
    bm = part.bm
    ceiling_index = ALL_ROWS.index('ceiling')
    body_index = ALL_ROWS.index('body')

    side_groups = {}
    windshield_faces = []
    rear_win_faces = []
    seam_faces = []

    for f in list(bm.faces):
        if len(f.verts) != 4:
            continue
        cx = sum(v.co.x for v in f.verts) / 4.0
        cy = sum(v.co.y for v in f.verts) / 4.0
        cz = sum(v.co.z for v in f.verts) / 4.0
        min_z = min(v.co.z for v in f.verts)
        max_z = max(v.co.z for v in f.verts)
        if abs(cx) > 0.56 and min_z >= z_belt_min and max_z - min_z > 0.18:
            side_key = 1 if cx > 0 else -1
            for bi, (y0, y1) in enumerate(side_win_bounds):
                if y0 <= cy <= y1:
                    side_groups.setdefault((side_key, bi), []).append(f)
                    break
        elif abs(cx) < 0.50 and front_win_y[0] <= cy <= front_win_y[1] and min_z >= z_belt_min - 0.04:
            windshield_faces.append(f)
        elif abs(cx) < 0.50 and rear_win_y[0] <= cy <= rear_win_y[1] and min_z >= z_belt_min - 0.04:
            rear_win_faces.append(f)
        elif abs(cx) > 0.80 and cz > 0.24 and max_z <= z_belt_min + 0.06:
            for sy0, sy1 in seam_y_bands:
                if sy0 <= cy <= sy1:
                    seam_faces.append(f)
                    break

    for group in side_groups.values():
        res = bmesh.ops.inset_region(bm, faces=group, thickness=0.022, depth=-0.016, use_boundary=True, use_even_offset=True)
        for f in group:
            f[part.row_layer] = ceiling_index
            f.smooth = False
        for f in res['faces']:
            f[part.row_layer] = ceiling_index
            f.smooth = False

    for group in (windshield_faces, rear_win_faces):
        if group:
            res = bmesh.ops.inset_region(bm, faces=group, thickness=0.026, depth=-0.016, use_boundary=True, use_even_offset=True)
            for f in group:
                f[part.row_layer] = ceiling_index
                f.smooth = False
            for f in res['faces']:
                f[part.row_layer] = ceiling_index
                f.smooth = False

    if seam_faces:
        res = bmesh.ops.inset_individual(bm, faces=seam_faces, thickness=0.002, depth=-0.008, use_even_offset=True)
        for f in seam_faces:
            f[part.row_layer] = body_index
            f.smooth = False
        for f in res['faces']:
            f[part.row_layer] = body_index
            f.smooth = False


def build_car_a():
    paint_key = 0.5
    car = HeroPart('car_a')
    r_wheel = 0.31
    y_front = -1.32
    y_rear = 1.32
    track = 0.77
    r_arch = 0.365
    z_under = 0.16
    z_sill = 0.195

    def make_st(yb, ym, yu, yt, xl, xf, xb, xs, xt, zb, zc, arch=False):
        za = arch_height(yb - y_front, r_arch, r_wheel, z_sill) if yb < 0 else arch_height(yb - y_rear, r_arch, r_wheel, z_sill)
        zf = max(za + 0.045, 0.36)
        zs = zb + 0.022
        zt = max(zs + 0.018, zc - 0.025)
        return {'yb': yb, 'ym': ym, 'yu': yu, 'yt': yt, 'xl': xl, 'xf': xf, 'xb': xb, 'xs': xs, 'xt': xt, 'za': za, 'zf': zf, 'zb': zb, 'zs': zs, 'zt': zt, 'zc': zc, 'arch': arch}

    stations = [
        make_st(-2.20, -2.20, -2.20, -2.20, 0.66, 0.68, 0.66, 0.60, 0.50, 0.56, 0.60),
        make_st(-2.12, -2.12, -2.12, -2.12, 0.78, 0.80, 0.78, 0.70, 0.56, 0.66, 0.70),
        make_st(-1.685, -1.685, -1.685, -1.685, 0.85, 0.875, 0.86, 0.78, 0.62, 0.76, 0.80, arch=True),
        make_st(-1.619, -1.619, -1.619, -1.619, 0.86, 0.885, 0.865, 0.78, 0.62, 0.78, 0.815, arch=True),
        make_st(-1.484, -1.484, -1.484, -1.484, 0.865, 0.89, 0.87, 0.785, 0.62, 0.80, 0.835, arch=True),
        make_st(-1.320, -1.320, -1.320, -1.320, 0.865, 0.895, 0.875, 0.79, 0.62, 0.815, 0.85, arch=True),
        make_st(-1.156, -1.156, -1.156, -1.156, 0.865, 0.89, 0.875, 0.79, 0.62, 0.83, 0.865, arch=True),
        make_st(-1.021, -1.021, -1.021, -1.021, 0.865, 0.885, 0.875, 0.79, 0.66, 0.845, 0.875, arch=True),
        make_st(-0.955, -0.955, -0.955, -0.955, 0.86, 0.88, 0.875, 0.79, 0.72, 0.855, 0.885),
        make_st(-0.880, -0.880, -0.880, -0.390, 0.86, 0.88, 0.875, 0.79, 0.62, 0.86, 1.425),
        make_st(-0.868, -0.868, -0.868, -0.330, 0.86, 0.88, 0.875, 0.79, 0.62, 0.862, 1.430),
        make_st(-0.040, -0.040, -0.040, -0.025, 0.86, 0.88, 0.875, 0.79, 0.615, 0.88, 1.440),
        make_st(-0.028, -0.028, -0.028, -0.012, 0.86, 0.88, 0.875, 0.79, 0.615, 0.88, 1.440),
        make_st(0.045, 0.045, 0.045, 0.045, 0.86, 0.88, 0.875, 0.79, 0.615, 0.885, 1.440),
        make_st(0.860, 0.860, 0.860, 0.560, 0.86, 0.88, 0.875, 0.79, 0.61, 0.905, 1.425),
        make_st(0.872, 0.872, 0.872, 0.620, 0.86, 0.88, 0.875, 0.79, 0.61, 0.908, 1.415),
        make_st(0.955, 0.955, 0.955, 0.680, 0.86, 0.885, 0.875, 0.79, 0.61, 0.912, 1.405),
        make_st(1.021, 1.021, 1.021, 1.440, 0.865, 0.885, 0.875, 0.785, 0.68, 0.92, 0.96, arch=True),
        make_st(1.156, 1.156, 1.156, 1.480, 0.865, 0.89, 0.875, 0.785, 0.64, 0.925, 0.96, arch=True),
        make_st(1.320, 1.320, 1.320, 1.540, 0.865, 0.895, 0.87, 0.78, 0.62, 0.93, 0.96, arch=True),
        make_st(1.484, 1.484, 1.484, 1.600, 0.865, 0.89, 0.865, 0.775, 0.61, 0.935, 0.96, arch=True),
        make_st(1.619, 1.619, 1.619, 1.650, 0.855, 0.88, 0.86, 0.77, 0.60, 0.935, 0.96, arch=True),
        make_st(1.685, 1.685, 1.685, 1.685, 0.845, 0.87, 0.85, 0.76, 0.58, 0.935, 0.955, arch=True),
        make_st(2.08, 2.08, 2.08, 2.08, 0.78, 0.81, 0.79, 0.70, 0.54, 0.89, 0.92),
        make_st(2.16, 2.16, 2.16, 2.16, 0.72, 0.75, 0.73, 0.64, 0.50, 0.82, 0.85),
        make_st(2.20, 2.20, 2.20, 2.20, 0.64, 0.66, 0.64, 0.56, 0.44, 0.74, 0.77),
    ]

    build_car_shell(
        car,
        stations,
        x_well=0.54,
        z_under=z_under,
        paint_key=paint_key,
        arch_rings={2, 3, 4, 5, 6, 7, 17, 18, 19, 20, 21, 22},
        pillar_rings={11, 12},
        dark_rings={0, 24},
    )

    recess_car_features(
        car,
        side_win_bounds=[(-0.58, -0.18), (0.14, 0.58)],
        front_win_y=(-0.92, -0.44),
        rear_win_y=(0.74, 1.38),
        seam_y_bands=[(-0.88, -0.865), (-0.042, -0.025), (0.858, 0.874)],
        z_belt_min=0.875,
    )

    for ay in (y_front, y_rear):
        car.tube([(-track, ay, r_wheel), (track, ay, r_wheel)], 0.032, 'metal', sides=6)

    for side in (-1, 1):
        for hy, hz in ((-0.18, 0.79), (0.64, 0.81)):
            box(car, (side * 0.875, hy, hz), (0.045, 0.14, 0.028), 'metal')
        mirror_assembly(car, side, 0.78, -0.80, 0.89, paint_key)

    box(car, (0, -2.17, 0.43), (0.96, 0.08, 0.20), 'ceiling')
    for gz in (0.38, 0.43, 0.48):
        box(car, (0, -2.195, gz), (0.88, 0.045, 0.015), 'metal')
    box(car, (0, -2.16, 0.22), (1.32, 0.11, 0.075), 'ceiling')
    license_plate(car, -2.205, 0.315, -1)

    for side in (-1, 1):
        box(car, (side * 0.58, -2.14, 0.59), (0.30, 0.09, 0.082), 'ceiling')

    box(car, (0, 2.18, 0.75), (1.34, 0.08, 0.09), 'ceiling')
    for side in (-1, 1):
        box(car, (side * 0.64, 2.13, 0.75), (0.18, 0.12, 0.085), 'ceiling')
    box(car, (0, 2.165, 0.27), (1.28, 0.11, 0.11), 'ceiling')
    license_plate(car, 2.20, 0.53, 1)
    for side in (-1, 1):
        car.revolve((side * 0.46, 2.09, 0.26), 'y', [(0.026, 0.0, 'metal'), (0.032, 0.15, 'metal'), (0.012, 0.15, 'ceiling')], segments=8, smooth=True)

    finalize_keys(car, {'trim': paint_key, 'ceiling': 0.5, 'floor': 0.5, 'body': 0.5, 'metal': 0.5, 'top': 0.5})

    head = HeroPart('car_a_lights_head')
    for side in (-1, 1):
        box(head, (side * 0.58, -2.172, 0.59), (0.26, 0.07, 0.048), 'screen')
    finalize_keys(head, {'screen': 0.0})

    tail = HeroPart('car_a_lights_tail')
    box(tail, (0, 2.195, 0.75), (1.26, 0.075, 0.044), 'keycap')
    for side in (-1, 1):
        box(tail, (side * 0.65, 2.145, 0.75), (0.14, 0.105, 0.052), 'keycap')
    finalize_keys(tail, {'keycap': 1.0})

    children = [
        (build_wheel('car_a_wheel_fl', r_wheel, 0.105, 0.68, 'trim', paint_key, spokes=5), (track, y_front, r_wheel)),
        (build_wheel('car_a_wheel_fr', r_wheel, 0.105, 0.68, 'trim', paint_key, spokes=5), (-track, y_front, r_wheel)),
        (build_wheel('car_a_wheel_rl', r_wheel, 0.105, 0.68, 'trim', paint_key, spokes=5), (track, y_rear, r_wheel)),
        (build_wheel('car_a_wheel_rr', r_wheel, 0.105, 0.68, 'trim', paint_key, spokes=5), (-track, y_rear, r_wheel)),
        (head, (0, 0, 0)),
        (tail, (0, 0, 0)),
    ]
    return car, children


def build_car_b():
    paint_key = 0.05
    car = HeroPart('car_b')
    r_wheel = 0.35
    y_front = -1.38
    y_rear = 1.38
    track = 0.79
    r_arch = 0.415
    z_under = 0.21
    z_sill = 0.25

    def make_st(yb, ym, yu, yt, xl, xf, xb, xs, xt, zb, zc, arch=False):
        za = arch_height(yb - y_front, r_arch, r_wheel, z_sill) if yb < 0 else arch_height(yb - y_rear, r_arch, r_wheel, z_sill)
        zf = max(za + 0.05, 0.44)
        zs = zb + 0.025
        zt = max(zs + 0.02, zc - 0.025)
        return {'yb': yb, 'ym': ym, 'yu': yu, 'yt': yt, 'xl': xl, 'xf': xf, 'xb': xb, 'xs': xs, 'xt': xt, 'za': za, 'zf': zf, 'zb': zb, 'zs': zs, 'zt': zt, 'zc': zc, 'arch': arch}

    stations = [
        make_st(-2.36, -2.36, -2.36, -2.36, 0.70, 0.73, 0.70, 0.62, 0.52, 0.78, 0.82),
        make_st(-2.26, -2.26, -2.26, -2.26, 0.80, 0.84, 0.81, 0.72, 0.58, 0.90, 0.94),
        make_st(-1.795, -1.795, -1.795, -1.795, 0.86, 0.89, 0.875, 0.79, 0.64, 0.98, 1.02, arch=True),
        make_st(-1.720, -1.720, -1.720, -1.720, 0.87, 0.90, 0.88, 0.795, 0.64, 0.99, 1.03, arch=True),
        make_st(-1.567, -1.567, -1.567, -1.567, 0.875, 0.905, 0.885, 0.80, 0.64, 1.00, 1.04, arch=True),
        make_st(-1.380, -1.380, -1.380, -1.380, 0.875, 0.91, 0.89, 0.805, 0.64, 1.01, 1.05, arch=True),
        make_st(-1.193, -1.193, -1.193, -1.193, 0.875, 0.905, 0.89, 0.805, 0.64, 1.02, 1.06, arch=True),
        make_st(-1.040, -1.040, -1.040, -1.040, 0.875, 0.90, 0.89, 0.805, 0.68, 1.03, 1.07, arch=True),
        make_st(-0.965, -0.965, -0.965, -0.965, 0.87, 0.895, 0.89, 0.805, 0.75, 1.035, 1.075),
        make_st(-0.900, -0.900, -0.900, -0.470, 0.87, 0.895, 0.89, 0.805, 0.66, 1.04, 1.655),
        make_st(-0.888, -0.888, -0.888, -0.410, 0.87, 0.895, 0.89, 0.805, 0.66, 1.042, 1.660),
        make_st(-0.020, -0.020, -0.020, -0.010, 0.87, 0.895, 0.89, 0.805, 0.66, 1.048, 1.670),
        make_st(-0.008, -0.008, -0.008, 0.002, 0.87, 0.895, 0.89, 0.805, 0.66, 1.048, 1.670),
        make_st(0.065, 0.065, 0.065, 0.065, 0.87, 0.895, 0.89, 0.805, 0.66, 1.05, 1.670),
        make_st(0.880, 0.880, 0.880, 0.880, 0.87, 0.895, 0.89, 0.805, 0.655, 1.055, 1.665),
        make_st(0.892, 0.892, 0.892, 0.892, 0.87, 0.895, 0.89, 0.805, 0.655, 1.055, 1.665),
        make_st(0.965, 0.965, 0.965, 0.965, 0.87, 0.895, 0.89, 0.805, 0.655, 1.058, 1.662),
        make_st(1.040, 1.040, 1.040, 1.040, 0.875, 0.90, 0.89, 0.805, 0.655, 1.06, 1.660, arch=True),
        make_st(1.193, 1.193, 1.193, 1.193, 0.875, 0.905, 0.89, 0.80, 0.65, 1.06, 1.655, arch=True),
        make_st(1.380, 1.380, 1.380, 1.380, 0.875, 0.91, 0.89, 0.80, 0.65, 1.06, 1.650, arch=True),
        make_st(1.567, 1.567, 1.567, 1.567, 0.875, 0.905, 0.885, 0.795, 0.645, 1.06, 1.645, arch=True),
        make_st(1.720, 1.720, 1.720, 1.720, 0.865, 0.895, 0.88, 0.79, 0.645, 1.06, 1.640, arch=True),
        make_st(1.795, 1.795, 1.795, 1.795, 0.86, 0.89, 0.875, 0.785, 0.645, 1.06, 1.635, arch=True),
        make_st(1.960, 1.960, 1.960, 1.850, 0.84, 0.87, 0.86, 0.77, 0.64, 1.055, 1.630),
        make_st(2.060, 2.060, 2.060, 1.920, 0.82, 0.85, 0.845, 0.76, 0.635, 1.05, 1.620),
        make_st(2.28, 2.28, 2.28, 2.28, 0.76, 0.79, 0.78, 0.70, 0.56, 1.00, 1.04),
        make_st(2.36, 2.36, 2.36, 2.36, 0.70, 0.73, 0.71, 0.62, 0.50, 0.94, 0.98),
    ]

    build_car_shell(
        car,
        stations,
        x_well=0.56,
        z_under=z_under,
        paint_key=paint_key,
        arch_rings={2, 3, 4, 5, 6, 7, 17, 18, 19, 20, 21, 22},
        pillar_rings={11, 12, 14, 15},
        dark_rings={0, 25},
    )

    recess_car_features(
        car,
        side_win_bounds=[(-0.62, -0.20), (0.16, 0.76), (1.00, 1.90)],
        front_win_y=(-0.94, -0.52),
        rear_win_y=(1.94, 2.22),
        seam_y_bands=[(-0.905, -0.885), (-0.022, -0.006), (0.878, 0.894)],
        z_belt_min=1.06,
    )

    for ay in (y_front, y_rear):
        car.tube([(-track, ay, r_wheel), (track, ay, r_wheel)], 0.036, 'metal', sides=6)

    for side in (-1, 1):
        for hy, hz in ((-0.16, 0.96), (0.72, 0.96)):
            box(car, (side * 0.89, hy, hz), (0.045, 0.145, 0.03), 'metal')
        car.tube([Vector((side * 0.55, -0.32, 1.63)), Vector((side * 0.55, -0.22, 1.70)), Vector((side * 0.54, 1.78, 1.67)), Vector((side * 0.54, 1.86, 1.60))], 0.022, 'metal', sides=4)
        mirror_assembly(car, side, 0.80, -0.88, 1.07, paint_key)

    before = set(car.bm.faces)
    box(car, (0, 1.97, 1.62), (1.24, 0.16, 0.045), 'trim')
    paint_from(car, before, paint_key)

    box(car, (0, -2.33, 0.62), (1.04, 0.10, 0.34), 'ceiling')
    for gz in (0.54, 0.62, 0.70):
        box(car, (0, -2.365, gz), (0.96, 0.045, 0.018), 'metal')
    box(car, (0, -2.32, 0.28), (1.36, 0.12, 0.11), 'ceiling')
    box(car, (0, -2.35, 0.245), (0.86, 0.08, 0.05), 'metal')
    license_plate(car, -2.365, 0.42, -1)

    for side in (-1, 1):
        box(car, (side * 0.61, -2.275, 0.82), (0.28, 0.10, 0.085), 'ceiling')

    box(car, (0, 2.34, 0.92), (1.42, 0.08, 0.10), 'ceiling')
    for side in (-1, 1):
        box(car, (side * 0.68, 2.29, 0.945), (0.16, 0.12, 0.115), 'ceiling')
    box(car, (0, 2.32, 0.32), (1.36, 0.12, 0.13), 'ceiling')
    box(car, (0, 2.35, 0.27), (0.86, 0.08, 0.065), 'metal')
    license_plate(car, 2.365, 0.66, 1)
    car.revolve((-0.46, 2.23, 0.28), 'y', [(0.030, 0.0, 'metal'), (0.036, 0.18, 'metal'), (0.014, 0.18, 'ceiling')], segments=6, smooth=True)

    finalize_keys(car, {'trim': paint_key, 'ceiling': 0.5, 'floor': 0.5, 'body': 0.5, 'metal': 0.5, 'top': 0.5})

    head = HeroPart('car_b_lights_head')
    for side in (-1, 1):
        box(head, (side * 0.61, -2.30, 0.82), (0.24, 0.085, 0.050), 'screen')
    finalize_keys(head, {'screen': 0.0})

    tail = HeroPart('car_b_lights_tail')
    box(tail, (0, 2.355, 0.92), (1.34, 0.075, 0.044), 'keycap')
    for side in (-1, 1):
        box(tail, (side * 0.69, 2.305, 0.945), (0.12, 0.105, 0.078), 'keycap')
    finalize_keys(tail, {'keycap': 1.0})

    children = [
        (build_wheel('car_b_wheel_fl', r_wheel, 0.115, 0.66, 'trim', paint_key, spokes=6, hub_segments=6), (track, y_front, r_wheel)),
        (build_wheel('car_b_wheel_fr', r_wheel, 0.115, 0.66, 'trim', paint_key, spokes=6, hub_segments=6), (-track, y_front, r_wheel)),
        (build_wheel('car_b_wheel_rl', r_wheel, 0.115, 0.66, 'trim', paint_key, spokes=6, hub_segments=6), (track, y_rear, r_wheel)),
        (build_wheel('car_b_wheel_rr', r_wheel, 0.115, 0.66, 'trim', paint_key, spokes=6, hub_segments=6), (-track, y_rear, r_wheel)),
        (head, (0, 0, 0)),
        (tail, (0, 0, 0)),
    ]
    return car, children


def motorbike_mirrors(part, handle_y, handle_z, handle_hw):
    for side in (-1, 1):
        part.tube(
            [
                (side * (handle_hw - 0.08), handle_y + 0.015, handle_z),
                (side * (handle_hw - 0.04), handle_y + 0.035, handle_z + 0.12),
                (side * (handle_hw + 0.025), handle_y + 0.055, handle_z + 0.16),
            ],
            0.007,
            'metal',
            sides=4,
        )
        box(part, (side * (handle_hw + 0.052), handle_y + 0.055, handle_z + 0.17), (0.094, 0.034, 0.052), 'ceiling')
        box(part, (side * (handle_hw + 0.052), handle_y + 0.068, handle_z + 0.17), (0.078, 0.016, 0.040), 'metal')


def motorbike_fender(part, y_wheel, r_wheel, half_width, paint_key):
    r0 = r_wheel + 0.026
    r1 = r0 + 0.028
    before = set(part.bm.faces)
    rings = []
    for deg in (148, 122, 95, 68, 42):
        a = math.radians(deg)
        ca, sa = math.cos(a), math.sin(a)
        rings.append([
            Vector((-half_width, y_wheel - ca * r0, r_wheel + sa * r0)),
            Vector((half_width, y_wheel - ca * r0, r_wheel + sa * r0)),
            Vector((half_width * 0.85, y_wheel - ca * r1, r_wheel + sa * r1)),
            Vector((-half_width * 0.85, y_wheel - ca * r1, r_wheel + sa * r1)),
        ])
    part.loft(rings, lambda r, c: 'trim', levels=0, closed=True, cap=True, smooth=True)
    paint_from(part, before, paint_key)


def motorbike_handlebars(part, stem_y, z0, z1, handle_hw, paint_key, cowl_w, cowl_d, cowl_h):
    before = set(part.bm.faces)
    part.loft(
        [
            [Vector((-0.065, stem_y - 0.04, z0)), Vector((0.065, stem_y - 0.04, z0)), Vector((0.055, stem_y + 0.03, z0)), Vector((-0.055, stem_y + 0.03, z0))],
            [Vector((-0.055, stem_y - 0.03, z1)), Vector((0.055, stem_y - 0.03, z1)), Vector((0.05, stem_y + 0.03, z1)), Vector((-0.05, stem_y + 0.03, z1))],
        ],
        lambda r, c: 'body',
        levels=0,
        closed=True,
        cap=True,
        smooth=False,
    )
    part.rounded_box((0, stem_y, z1 + 0.03), (cowl_w, cowl_d, cowl_h), 'trim', radius=0.022, segments=1)
    paint_from(part, before, paint_key)
    box(part, (0, stem_y + 0.025, z1 + 0.075), (cowl_w * 0.56, cowl_d * 0.58, 0.036), 'ceiling')
    part.tube([(-(handle_hw - 0.05), stem_y + 0.035, z1 + 0.03), (-0.10, stem_y, z1 + 0.03), (0.10, stem_y, z1 + 0.03), (handle_hw - 0.05, stem_y + 0.035, z1 + 0.03)], 0.014, 'metal', sides=6)
    for side in (-1, 1):
        part.tube([(side * (handle_hw - 0.07), stem_y + 0.03, z1 + 0.03), (side * (handle_hw + 0.04), stem_y + 0.06, z1 + 0.03)], 0.021, 'ceiling', sides=6)
        part.tube([(side * (handle_hw - 0.07), stem_y + 0.015, z1 + 0.022), (side * (handle_hw + 0.015), stem_y - 0.015, z1 + 0.014)], 0.006, 'metal', sides=4)
    motorbike_mirrors(part, stem_y + 0.015, z1 + 0.035, handle_hw - 0.02)


def build_motorbike_a():
    paint_key = 0.08
    bike = HeroPart('motorbike_a')
    r_wheel = 0.27
    y_front = -0.62
    y_rear = 0.62

    bike.tube([(-0.068, y_front, r_wheel), (0.068, y_front, r_wheel)], 0.018, 'metal', sides=4)
    bike.tube([(-0.078, y_rear, r_wheel), (0.078, y_rear, r_wheel)], 0.018, 'metal', sides=4)
    for side in (-1, 1):
        bike.tube([(side * 0.062, -0.43, 0.78), (side * 0.062, -0.52, 0.44)], 0.019, 'metal', sides=6)
        bike.tube([(side * 0.062, -0.50, 0.56), (side * 0.062, y_front, r_wheel)], 0.024, 'body', sides=6)
        bike.tube([(side * 0.072, 0.06, 0.30), (side * 0.072, y_rear, r_wheel)], 0.019, 'metal', sides=4)
        bike.tube([(side * 0.085, 0.48, 0.48), (side * 0.076, y_rear - 0.02, r_wheel + 0.04)], 0.018, 'metal', sides=4)
        bike.tube([(side * 0.085, 0.43, 0.62), (side * 0.082, 0.50, 0.44)], 0.025, 'body', sides=4)

    bike.tube([(0, -0.43, 0.76), (0, -0.32, 0.44), (0, -0.02, 0.44), (0, 0.10, 0.58)], 0.026, 'body', sides=4)
    bike.tube([(-0.045, -0.36, 0.56), (-0.055, -0.18, 0.28), (-0.055, 0.08, 0.29)], 0.014, 'body', sides=4)
    bike.tube([(0.045, -0.36, 0.56), (0.055, -0.18, 0.28), (0.055, 0.08, 0.29)], 0.014, 'body', sides=4)

    bike.tube([(-0.06, 0.02, 0.24), (-0.09, 0.09, 0.018), (0.09, 0.09, 0.018), (0.06, 0.02, 0.24)], 0.011, 'metal', sides=4)

    box(bike, (0, -0.06, 0.28), (0.18, 0.24, 0.14), 'body')
    box(bike, (0, -0.05, 0.265), (0.21, 0.15, 0.09), 'metal')
    box(bike, (0, -0.22, 0.28), (0.12, 0.14, 0.10), 'metal')
    for fy in (-0.24, -0.20):
        box(bike, (0, fy, 0.28), (0.135, 0.012, 0.115), 'body')

    before = set(bike.bm.faces)
    bike.loft(
        [
            [Vector((-0.075, -0.56, 0.56)), Vector((0.075, -0.56, 0.56)), Vector((0.07, -0.56, 0.72)), Vector((-0.07, -0.56, 0.72))],
            [Vector((-0.11, -0.44, 0.44)), Vector((0.11, -0.44, 0.44)), Vector((0.10, -0.44, 0.72)), Vector((-0.10, -0.44, 0.72))],
            [Vector((-0.07, -0.28, 0.40)), Vector((0.07, -0.28, 0.40)), Vector((0.06, -0.28, 0.56)), Vector((-0.06, -0.28, 0.56))],
        ],
        lambda r, c: 'trim',
        levels=0,
        closed=True,
        cap=True,
        smooth=True,
    )
    for side in (-1, 1):
        bike.loft(
            [
                [Vector((side * 0.065, -0.53, 0.48)), Vector((side * 0.12, -0.51, 0.48)), Vector((side * 0.13, -0.51, 0.69)), Vector((side * 0.07, -0.53, 0.69))],
                [Vector((side * 0.07, -0.39, 0.34)), Vector((side * 0.19, -0.39, 0.34)), Vector((side * 0.18, -0.39, 0.65)), Vector((side * 0.08, -0.39, 0.65))],
                [Vector((side * 0.06, -0.26, 0.32)), Vector((side * 0.15, -0.26, 0.32)), Vector((side * 0.13, -0.26, 0.54)), Vector((side * 0.06, -0.26, 0.54))],
            ],
            lambda r, c: 'trim',
            levels=0,
            closed=True,
            cap=True,
            smooth=True,
        )
    bike.loft(
        [
            [Vector((-0.065, -0.02, 0.46)), Vector((0.065, -0.02, 0.46)), Vector((0.06, -0.02, 0.56)), Vector((-0.06, -0.02, 0.56))],
            [Vector((-0.10, 0.15, 0.50)), Vector((0.10, 0.15, 0.50)), Vector((0.095, 0.15, 0.69)), Vector((-0.095, 0.15, 0.69))],
            [Vector((-0.115, 0.40, 0.57)), Vector((0.115, 0.40, 0.57)), Vector((0.105, 0.40, 0.74)), Vector((-0.105, 0.40, 0.74))],
            [Vector((-0.095, 0.68, 0.63)), Vector((0.095, 0.68, 0.63)), Vector((0.085, 0.68, 0.77)), Vector((-0.085, 0.68, 0.77))],
            [Vector((-0.062, 0.85, 0.68)), Vector((0.062, 0.85, 0.68)), Vector((0.052, 0.85, 0.78)), Vector((-0.052, 0.85, 0.78))],
        ],
        lambda r, c: 'trim' if r >= 1 else 'body',
        levels=0,
        closed=True,
        cap=True,
        smooth=True,
    )
    paint_from(bike, before, paint_key)

    motorbike_fender(bike, y_front, r_wheel, 0.065, paint_key)

    bike.rounded_box((0, 0.14, 0.73), (0.20, 0.44, 0.085), 'floor', radius=0.022, segments=1)
    bike.rounded_box((0, 0.46, 0.76), (0.18, 0.25, 0.08), 'floor', radius=0.020, segments=1)
    bike.tube([(-0.065, 0.62, 0.745), (-0.10, 0.79, 0.79), (0.10, 0.79, 0.79), (0.065, 0.62, 0.745)], 0.012, 'metal', sides=4)

    for side in (-1, 1):
        box(bike, (side * 0.115, -0.50, 0.64), (0.036, 0.06, 0.052), 'strip')

    box(bike, (0, 0.835, 0.73), (0.125, 0.075, 0.062), 'ceiling')
    bike.loft(
        [
            [Vector((-0.052, 0.72, 0.65)), Vector((0.052, 0.72, 0.65)), Vector((0.048, 0.76, 0.67)), Vector((-0.048, 0.76, 0.67))],
            [Vector((-0.058, 0.90, 0.44)), Vector((0.058, 0.90, 0.44)), Vector((0.052, 0.93, 0.46)), Vector((-0.052, 0.93, 0.46))],
        ],
        lambda r, c: 'ceiling',
        levels=0,
        closed=True,
        cap=True,
        smooth=False,
    )
    license_plate(bike, 0.88, 0.55, 1, width=0.155, height=0.105)

    bike.tube([(-0.05, -0.22, 0.22), (-0.11, -0.02, 0.20), (-0.145, 0.18, 0.21), (-0.15, 0.74, 0.39)], 0.016, 'metal', sides=4)
    box(bike, (-0.15, 0.53, 0.34), (0.068, 0.38, 0.088), 'ceiling')
    box(bike, (-0.175, 0.53, 0.34), (0.036, 0.30, 0.058), 'metal')

    for side in (-1, 1):
        bike.tube([(side * 0.06, 0.00, 0.23), (side * 0.21, 0.00, 0.23)], 0.013, 'ceiling', sides=4)
        bike.tube([(side * 0.06, 0.36, 0.29), (side * 0.18, 0.36, 0.29)], 0.011, 'metal', sides=4)

    motorbike_handlebars(bike, -0.44, 0.70, 0.89, 0.28, paint_key, 0.25, 0.15, 0.105)

    finalize_keys(bike, {'trim': paint_key, 'ceiling': 0.5, 'floor': 0.5, 'body': 0.5, 'metal': 0.5, 'top': 0.5, 'strip': 0.5})

    head = HeroPart('motorbike_a_lights_head')
    box(head, (0, -0.505, 0.92), (0.15, 0.055, 0.062), 'screen')
    finalize_keys(head, {'screen': 0.0})

    tail = HeroPart('motorbike_a_lights_tail')
    box(tail, (0, 0.86, 0.73), (0.10, 0.05, 0.040), 'keycap')
    finalize_keys(tail, {'keycap': 1.0})

    children = [
        (build_wheel('motorbike_a_wheel_front', r_wheel, 0.038, 0.74, 'trim', paint_key, spokes=5), (0, y_front, r_wheel)),
        (build_wheel('motorbike_a_wheel_rear', r_wheel, 0.044, 0.74, 'trim', paint_key, spokes=5), (0, y_rear, r_wheel)),
        (head, (0, 0, 0)),
        (tail, (0, 0, 0)),
    ]
    return bike, children


def build_motorbike_b():
    paint_key = 0.5
    bike = HeroPart('motorbike_b')
    r_wheel = 0.24
    y_front = -0.64
    y_rear = 0.64

    bike.tube([(-0.072, y_front, r_wheel), (0.072, y_front, r_wheel)], 0.018, 'metal', sides=6)
    bike.tube([(-0.085, y_rear, r_wheel), (0.085, y_rear, r_wheel)], 0.018, 'metal', sides=6)
    for side in (-1, 1):
        bike.tube([(side * 0.068, -0.44, 0.72), (side * 0.068, -0.52, 0.42)], 0.021, 'metal', sides=6)
        bike.tube([(side * 0.068, -0.48, 0.52), (side * 0.068, y_front, r_wheel)], 0.025, 'body', sides=6)
        bike.tube([(side * 0.082, 0.14, 0.25), (side * 0.080, y_rear, r_wheel)], 0.021, 'metal', sides=4)
        bike.tube([(side * 0.10, 0.44, 0.58), (side * 0.09, y_rear - 0.03, r_wheel + 0.04)], 0.019, 'metal', sides=4)

    bike.tube([(-0.07, 0.04, 0.20), (-0.095, 0.12, 0.018), (0.095, 0.12, 0.018), (0.07, 0.04, 0.20)], 0.011, 'metal', sides=4)

    bike.rounded_box((0, -0.05, 0.21), (0.34, 0.52, 0.09), 'ceiling', radius=0.020, segments=1)
    box(bike, (0, -0.05, 0.245), (0.29, 0.42, 0.035), 'floor')

    before = set(bike.bm.faces)
    bike.loft(
        [
            [Vector((0.0, -0.72, 0.47)), Vector((-0.07, -0.69, 0.49)), Vector((-0.06, -0.69, 0.62)), Vector((0.0, -0.72, 0.64)), Vector((0.06, -0.69, 0.62)), Vector((0.07, -0.69, 0.49))],
            [Vector((0.0, -0.63, 0.36)), Vector((-0.14, -0.58, 0.38)), Vector((-0.13, -0.58, 0.72)), Vector((0.0, -0.62, 0.74)), Vector((0.13, -0.58, 0.72)), Vector((0.14, -0.58, 0.38))],
            [Vector((0.0, -0.45, 0.25)), Vector((-0.17, -0.42, 0.27)), Vector((-0.15, -0.42, 0.77)), Vector((0.0, -0.44, 0.79)), Vector((0.15, -0.42, 0.77)), Vector((0.17, -0.42, 0.27))],
            [Vector((0.0, -0.27, 0.22)), Vector((-0.14, -0.28, 0.24)), Vector((-0.11, -0.29, 0.70)), Vector((0.0, -0.27, 0.71)), Vector((0.11, -0.29, 0.70)), Vector((0.14, -0.28, 0.24))],
        ],
        lambda r, c: 'trim',
        levels=0,
        closed=True,
        cap=True,
        smooth=True,
    )
    bike.loft(
        [
            [Vector((0.0, 0.08, 0.26)), Vector((-0.11, 0.08, 0.28)), Vector((-0.12, 0.10, 0.66)), Vector((0.0, 0.09, 0.68)), Vector((0.12, 0.10, 0.66)), Vector((0.11, 0.08, 0.28))],
            [Vector((0.0, 0.36, 0.38)), Vector((-0.17, 0.36, 0.42)), Vector((-0.16, 0.36, 0.72)), Vector((0.0, 0.36, 0.74)), Vector((0.16, 0.36, 0.72)), Vector((0.17, 0.36, 0.42))],
            [Vector((0.0, 0.62, 0.50)), Vector((-0.15, 0.62, 0.54)), Vector((-0.13, 0.62, 0.77)), Vector((0.0, 0.62, 0.78)), Vector((0.13, 0.62, 0.77)), Vector((0.15, 0.62, 0.54))],
            [Vector((0.0, 0.79, 0.60)), Vector((-0.10, 0.79, 0.62)), Vector((-0.09, 0.79, 0.78)), Vector((0.0, 0.79, 0.79)), Vector((0.09, 0.79, 0.78)), Vector((0.10, 0.79, 0.62))],
            [Vector((0.0, 0.89, 0.66)), Vector((-0.068, 0.89, 0.67)), Vector((-0.06, 0.89, 0.77)), Vector((0.0, 0.89, 0.78)), Vector((0.06, 0.89, 0.77)), Vector((0.068, 0.89, 0.67))],
        ],
        lambda r, c: 'trim',
        levels=0,
        closed=True,
        cap=True,
        smooth=True,
    )
    paint_from(bike, before, paint_key)

    motorbike_fender(bike, y_front, r_wheel, 0.072, paint_key)

    bike.rounded_box((0, 0.18, 0.725), (0.27, 0.38, 0.105), 'floor', radius=0.026, segments=1)
    bike.rounded_box((0, 0.48, 0.775), (0.24, 0.28, 0.095), 'floor', radius=0.024, segments=1)
    bike.tube([(-0.11, 0.64, 0.78), (-0.115, 0.82, 0.80), (0.115, 0.82, 0.80), (0.11, 0.64, 0.78)], 0.014, 'metal', sides=4)

    box(bike, (0, -0.70, 0.55), (0.12, 0.06, 0.095), 'ceiling')
    for side in (-1, 1):
        box(bike, (side * 0.085, -0.625, 0.64), (0.055, 0.055, 0.030), 'strip')

    box(bike, (0, 0.875, 0.72), (0.15, 0.075, 0.068), 'ceiling')
    bike.loft(
        [
            [Vector((-0.058, 0.76, 0.63)), Vector((0.058, 0.76, 0.63)), Vector((0.052, 0.80, 0.65)), Vector((-0.052, 0.80, 0.65))],
            [Vector((-0.062, 0.92, 0.42)), Vector((0.062, 0.92, 0.42)), Vector((0.058, 0.95, 0.44)), Vector((-0.058, 0.95, 0.44))],
        ],
        lambda r, c: 'ceiling',
        levels=0,
        closed=True,
        cap=True,
        smooth=False,
    )
    license_plate(bike, 0.90, 0.52, 1, width=0.155, height=0.105)

    bike.rounded_box((0.14, 0.36, 0.27), (0.085, 0.42, 0.13), 'body', radius=0.018, segments=1)
    bike.tube([(-0.11, 0.10, 0.22), (-0.16, 0.26, 0.21), (-0.17, 0.75, 0.37)], 0.018, 'metal', sides=6)
    bike.rounded_box((-0.17, 0.54, 0.32), (0.080, 0.40, 0.10), 'ceiling', radius=0.018, segments=1)
    box(bike, (-0.198, 0.54, 0.32), (0.036, 0.32, 0.068), 'metal')

    for side in (-1, 1):
        bike.tube([(side * 0.12, 0.18, 0.26), (side * 0.21, 0.18, 0.26)], 0.012, 'metal', sides=4)

    motorbike_handlebars(bike, -0.44, 0.70, 0.89, 0.29, paint_key, 0.28, 0.16, 0.115)

    finalize_keys(bike, {'trim': paint_key, 'ceiling': 0.5, 'floor': 0.5, 'body': 0.5, 'metal': 0.5, 'top': 0.5, 'strip': 0.5})

    head = HeroPart('motorbike_b_lights_head')
    box(head, (0, -0.51, 0.925), (0.175, 0.055, 0.068), 'screen')
    finalize_keys(head, {'screen': 0.0})

    tail = HeroPart('motorbike_b_lights_tail')
    box(tail, (0, 0.90, 0.72), (0.125, 0.05, 0.044), 'keycap')
    finalize_keys(tail, {'keycap': 1.0})

    children = [
        (build_wheel('motorbike_b_wheel_front', r_wheel, 0.046, 0.68, 'trim', paint_key, spokes=6), (0, y_front, r_wheel)),
        (build_wheel('motorbike_b_wheel_rear', r_wheel, 0.056, 0.68, 'trim', paint_key, spokes=6), (0, y_rear, r_wheel)),
        (head, (0, 0, 0)),
        (tail, (0, 0, 0)),
    ]
    return bike, children
