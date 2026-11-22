import math

from mathutils import Vector

from hero_kit import HeroPart
from hero_solid import bolt, cyl, obox, prism_x, prism_y, prism_z, rbox, slope_prism, tag


def build_water():
    part = HeroPart('water_a')
    rbox(part, (0.0, 0.0, 0.05), (16.0, 16.0, 0.10), 'body')
    for xi in (-4.0, 4.0):
        for yi in (-4.0, 4.0):
            rbox(part, (xi, yi, 0.11), (7.92, 7.92, 0.015), 'floor')
    return part


def build_quay():
    part = HeroPart('quay_a')
    rbox(part, (0.0, -1.05, 0.15), (4.0, 0.30, 0.30), 'metal', radius=0.01)
    rbox(part, (0.0, -0.90, 0.85), (4.0, 0.56, 1.10), 'wall', radius=0.01)
    rbox(part, (0.0, -0.90, 1.525), (4.0, 0.60, 0.15), 'trim', radius=0.01)

    rbox(part, (0.0, 0.55, 0.80), (4.0, 2.30, 1.60), 'wall')
    rbox(part, (0.0, 0.55, 1.61), (3.92, 2.22, 0.015), 'floor')
    rbox(part, (0.0, -0.525, 1.622), (3.88, 0.14, 0.010), 'top')

    rbox(part, (0.0, -0.38, 1.61), (3.80, 0.06, 0.01), 'metal')
    for step in range(-18, 19, 4):
        x = step / 10.0
        rbox(part, (x, -0.38, 1.622), (0.035, 0.054, 0.01), 'metal')

    rbox(part, (0.0, 1.65, 1.675), (3.84, 0.14, 0.15), 'metal', radius=0.01)

    for px in (-1.8, 0.0, 1.8):
        rbox(part, (px, -1.05, 1.615), (0.16, 0.16, 0.035), 'metal')
        for bx in (-0.05, 0.05):
            for by in (-0.05, 0.05):
                bolt(part, (px + bx, -1.05 + by, 1.628), (0.0, 0.0, 1.0), 0.012, 0.02)
        rbox(part, (px, -1.05, 2.12), (0.08, 0.08, 1.02), 'metal')

    rbox(part, (0.0, -1.05, 2.65), (4.0, 0.10, 0.06), 'metal', radius=0.015)
    rbox(part, (0.0, -1.05, 2.605), (3.92, 0.03, 0.01), 'strip')
    for rz in (1.85, 2.10, 2.35):
        cyl(part, (-1.94, -1.05, rz), (1.94, -1.05, rz), 0.015, 'metal', sides=8)

    for bx in (-0.9, 0.9):
        cyl(part, (bx, -0.65, 1.58), (bx, -0.65, 1.642), 0.12, 'metal', sides=10)
        for i in range(4):
            a = i * math.pi / 2.0 + math.pi / 4.0
            bolt(part, (bx + 0.085 * math.cos(a), -0.65 + 0.085 * math.sin(a), 1.640), (0.0, 0.0, 1.0), 0.01, 0.018)
        cyl(part, (bx, -0.65, 1.642), (bx, -0.65, 2.05), 0.075, 'metal', sides=10)
        cyl(part, (bx, -0.65, 2.05), (bx, -0.65, 2.18), 0.068, 'accent', sides=10)
        for i in range(4):
            a = i * math.pi / 2.0
            rbox(part, (bx + 0.076 * math.cos(a), -0.65 + 0.076 * math.sin(a), 2.115), (0.014, 0.014, 0.13), 'metal')
        cyl(part, (bx, -0.65, 2.18), (bx, -0.65, 2.25), 0.085, 'metal', sides=10)

    return part


def build_quaystep():
    part = HeroPart('quaystep_a')
    for wx, sign in ((-1.75, -1), (1.75, 1)):
        rbox(part, (wx, 0.25, 0.85), (0.50, 2.90, 1.70), 'wall', radius=0.01)
        rbox(part, (wx, 0.25, 1.73), (0.52, 2.92, 0.06), 'trim', radius=0.01)
        for rz, ry in ((0.8, -0.6), (1.1, 0.0), (1.4, 0.6)):
            rbox(part, (wx - sign * 0.254, ry, rz), (0.008, 0.15, 0.06), 'strip')
        cyl(part, (wx, -1.08, 0.84), (wx, 1.58, 2.41), 0.025, 'metal', sides=8)

    stair_profile = [
        (1.70, 1.60),
        (1.30, 1.60),
        (1.30, 1.39),
        (0.90, 1.39),
        (0.90, 1.18),
        (0.50, 1.18),
        (0.50, 0.97),
        (0.10, 0.97),
        (0.10, 0.76),
        (-0.30, 0.76),
        (-0.30, 0.55),
        (-0.70, 0.55),
        (-0.70, 0.36),
        (-1.10, 0.36),
        (-1.10, 0.02),
        (1.70, 0.02),
    ]
    prism_x(part, stair_profile, -1.48, 1.48, 'wall')

    steps = [
        (1.50, 1.60),
        (1.10, 1.39),
        (0.70, 1.18),
        (0.30, 0.97),
        (-0.10, 0.76),
        (-0.50, 0.55),
        (-0.90, 0.36),
    ]
    for sy, sz in steps:
        rbox(part, (0.0, sy, sz + 0.008), (2.92, 0.36, 0.014), 'floor')
        rbox(part, (0.0, sy - 0.165, sz + 0.012), (2.86, 0.035, 0.016), 'metal')

    cyl(part, (0.0, -0.85, 0.34), (0.0, -0.85, 1.22), 0.03, 'metal', sides=8)
    cyl(part, (0.0, 0.30, 0.95), (0.0, 0.30, 1.83), 0.03, 'metal', sides=8)
    cyl(part, (0.0, 1.45, 1.58), (0.0, 1.45, 2.46), 0.03, 'metal', sides=8)
    cyl(part, (0.0, -0.88, 1.25), (0.0, 1.48, 2.49), 0.025, 'metal', sides=8)

    return part


def build_pier():
    part = HeroPart('pier_a')
    rbox(part, (0.0, 1.80, 0.19), (5.90, 3.48, 0.36), 'metal', radius=0.01)
    rbox(part, (0.0, 1.80, 0.395), (5.80, 3.38, 0.015), 'floor')

    for step in range(-27, 28, 6):
        x = step / 10.0
        rbox(part, (x, 1.83, 0.408), (0.03, 3.06, 0.008), 'top')
    rbox(part, (0.0, 0.22, 0.406), (5.60, 0.08, 0.006), 'accent')

    for fx in (-2.94, 2.94):
        cyl(part, (fx, 0.15, 0.22), (fx, 3.45, 0.22), 0.055, 'soft', sides=8)
    cyl(part, (-2.85, 3.54, 0.22), (2.85, 3.54, 0.22), 0.055, 'soft', sides=8)

    rbox(part, (0.0, 3.50, 0.475), (5.76, 0.06, 0.14), 'metal')
    rbox(part, (-2.90, 1.80, 0.465), (0.06, 3.36, 0.10), 'metal')
    rbox(part, (2.90, 1.80, 0.465), (0.06, 3.36, 0.10), 'metal')

    for bx in (-2.2, -0.7, 0.7, 2.2):
        rbox(part, (bx, 3.32, 0.415), (0.28, 0.16, 0.03), 'metal')
        for ox in (-0.08, 0.08):
            bolt(part, (bx + ox, 3.32, 0.424), (0.0, 0.0, 1.0), 0.01, 0.018)
            cyl(part, (bx + ox, 3.32, 0.42), (bx + ox, 3.32, 0.65), 0.035, 'metal', sides=8)
        cyl(part, (bx - 0.12, 3.32, 0.58), (bx + 0.12, 3.32, 0.58), 0.018, 'metal', sides=8)

    for px in (-2.5, 2.5):
        cyl(part, (px, 0.35, 0.0), (px, 0.35, 3.20), 0.11, 'metal', sides=12)
        rbox(part, (px, 0.35, 0.44), (0.36, 0.36, 0.16), 'metal')
        cyl(part, (px, 0.35, 3.20), (px, 0.35, 3.30), 0.12, 'accent', sides=10)

    cyl(part, (-1.8, 0.35, 0.38), (-1.8, 0.35, 1.50), 0.025, 'metal', sides=8)
    cyl(part, (-1.8, 0.35, 1.15), (-1.8, 0.35, 1.16), 0.28, 'accent', sides=12, end_radius=0.28)
    cyl(part, (-1.8, 0.35, 1.14), (-1.8, 0.35, 1.17), 0.16, 'strip', sides=12, end_radius=0.16)

    return part


def build_deck():
    part = HeroPart('deck_a')

    girder_profile = [
        (-2.20, 0.32),
        (2.20, 0.32),
        (3.45, 1.10),
        (3.45, 1.14),
        (-3.45, 1.14),
        (-3.45, 1.10),
    ]
    prism_x(part, girder_profile, -8.0, 8.0, 'metal')

    for rx in (-6.0, -2.0, 2.0, 6.0):
        prism_y(part, [(rx - 0.05, 0.34), (rx + 0.05, 0.34), (rx + 0.05, 1.08), (rx - 0.05, 1.08)], -3.42, -2.22, 'metal')
        prism_y(part, [(rx - 0.05, 0.34), (rx + 0.05, 0.34), (rx + 0.05, 1.08), (rx - 0.05, 1.08)], 2.22, 3.42, 'metal')

    rbox(part, (0.0, 0.0, 1.185), (15.96, 4.00, 0.030), 'body')

    for dx in (-5.0, -1.67, 1.67, 5.0):
        rbox(part, (dx, 0.0, 1.205), (1.80, 0.14, 0.008), 'wall')
    rbox(part, (0.0, -1.90, 1.205), (15.90, 0.10, 0.008), 'wall')
    rbox(part, (0.0, 1.90, 1.205), (15.90, 0.10, 0.008), 'wall')

    rbox(part, (0.0, 2.05, 1.265), (15.96, 0.20, 0.13), 'wall')
    rbox(part, (0.0, -2.05, 1.265), (15.96, 0.20, 0.13), 'wall')

    rbox(part, (0.0, 2.775, 1.25), (15.92, 1.25, 0.18), 'wall')
    rbox(part, (0.0, 2.775, 1.346), (15.90, 1.23, 0.012), 'floor')

    rbox(part, (0.0, -2.775, 1.25), (15.92, 1.25, 0.18), 'wall')
    rbox(part, (0.0, -2.775, 1.346), (15.90, 1.23, 0.012), 'floor')

    for side_y in (-3.40, 3.40):
        rbox(part, (0.0, side_y, 2.38), (16.0, 0.08, 0.05), 'metal', radius=0.01)
        rbox(part, (0.0, side_y, 2.345), (15.92, 0.03, 0.012), 'strip')
        for px in (-7.0, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0, 7.0):
            rbox(part, (px, side_y, 1.875), (0.06, 0.06, 1.05), 'metal')
        for rz in (1.62, 1.88, 2.14):
            cyl(part, (-7.92, side_y, rz), (7.92, side_y, rz), 0.015, 'metal', sides=8)

    for ax in (-6.00, -3.80, -1.60, 0.60):
        rbox(part, (ax, 2.05, 1.35), (0.48, 0.22, 0.04), 'metal')
        for bx in (-0.16, 0.16):
            for by in (-0.06, 0.06):
                bolt(part, (ax + bx, 2.05 + by, 1.37), (0.0, 0.0, 1.0), 0.012, 0.02)
        cyl(part, (ax, 2.05, 1.37), (ax, 2.05, 1.45), 0.085, 'metal', sides=8)
        cyl(part, (ax, 2.05, 1.41), (ax, 2.05, 1.44), 0.105, 'accent', sides=8)

    rbox(part, (-7.95, 0.0, 1.15), (0.06, 3.90, 0.04), 'metal')
    rbox(part, (7.95, 0.0, 1.15), (0.06, 3.90, 0.04), 'metal')

    return part


def build_chamfer_mast(part, z_base, z_top, x_base, tilt_angle, w_base, w_top, d_base, d_top, slices, row):
    bm = part.bm
    rings = []
    tan_tilt = math.tan(tilt_angle)
    height = z_top - z_base
    for k in range(slices):
        t = k / (slices - 1)
        z = z_base + height * t
        cx = x_base + (z - z_base) * tan_tilt
        cy = 2.20
        wx = w_base + (w_top - w_base) * t
        wy = d_base + (d_top - d_base) * t
        c = 0.22 * min(wx, wy)
        hwx = wx * 0.5
        hwy = wy * 0.5
        pts = [
            (cx + hwx, cy + hwy - c, z),
            (cx + hwx - c, cy + hwy, z),
            (cx - hwx + c, cy + hwy, z),
            (cx - hwx, cy + hwy - c, z),
            (cx - hwx, cy - hwy + c, z),
            (cx - hwx + c, cy - hwy, z),
            (cx + hwx - c, cy - hwy, z),
            (cx + hwx, cy - hwy + c, z),
        ]
        rings.append([bm.verts.new(p) for p in pts])

    faces = []
    faces.append(bm.faces.new(list(reversed(rings[0]))))
    faces.append(bm.faces.new(rings[-1]))
    for k in range(slices - 1):
        r0 = rings[k]
        r1 = rings[k + 1]
        for i in range(8):
            j = (i + 1) % 8
            faces.append(bm.faces.new([r0[i], r0[j], r1[j], r1[i]]))
    tag(part, faces, row, smooth=True)
    return rings


def build_pylon():
    part = HeroPart('pylon_a')

    rbox(part, (3.80, 2.20, 0.90), (4.40, 2.60, 1.80), 'wall', radius=0.08)
    rbox(part, (3.80, 2.20, 1.94), (3.20, 2.30, 0.32), 'trim', radius=0.04)
    rbox(part, (3.80, 2.20, 2.145), (2.60, 2.10, 0.11), 'metal')
    for px in (-1.1, 1.1):
        for py in (-0.9, 0.9):
            bolt(part, (3.80 + px, 2.20 + py, 2.15), (0.0, 0.0, 1.0), 0.02, 0.08)

    tilt_angle = math.radians(13.0)
    tan_tilt = math.tan(tilt_angle)
    rings = build_chamfer_mast(part, 2.20, 27.00, 3.80, tilt_angle, 1.90, 0.95, 2.00, 1.00, 16, 'wall')

    for r_idx in range(len(rings) - 1):
        r0 = rings[r_idx]
        r1 = rings[r_idx + 1]
        p0_a = r0[2].co
        p1_a = r1[2].co
        obox(part, p0_a, p1_a, 0.035, 0.035, 'accent')
        p0_b = r0[5].co
        p1_b = r1[5].co
        obox(part, p0_b, p1_b, 0.035, 0.035, 'accent')

    top_cx = 3.80 + 24.80 * tan_tilt
    rbox(part, (top_cx, 2.20, 27.06), (1.60, 1.60, 0.12), 'trim')
    rbox(part, (top_cx, 2.20, 27.20), (1.20, 1.20, 0.16), 'metal')
    cyl(part, (top_cx, 2.20, 27.28), (top_cx, 2.20, 28.05), 0.08, 'metal', sides=8, end_radius=0.03)
    cyl(part, (top_cx, 2.20, 28.05), (top_cx, 2.20, 28.18), 0.06, 'strip', sides=8)

    deck_anchors = [
        (-6.00, 2.05, 1.45),
        (-3.80, 2.05, 1.45),
        (-1.60, 2.05, 1.45),
        (0.60, 2.05, 1.45),
    ]

    cable_heights = (25.60, 24.00, 22.40, 20.80)
    for i, d_pt in enumerate(deck_anchors):
        zh = cable_heights[i]
        frac = (zh - 2.20) / 24.80
        cx = 3.80 + (zh - 2.20) * tan_tilt
        wx = 1.90 - 0.95 * frac
        px = cx - wx * 0.5 - 0.05
        p_pt = (px, 2.05, zh)

        d_vec = Vector(d_pt)
        p_vec = Vector(p_pt)
        dir_v = (p_vec - d_vec).normalized()

        d_sleeve = d_vec + dir_v * 0.35
        p_sleeve = p_vec - dir_v * 0.35

        cyl(part, d_vec, d_sleeve, 0.085, 'metal', sides=8)
        cyl(part, d_sleeve, p_sleeve, 0.045, 'strip', sides=8)
        cyl(part, p_sleeve, p_vec, 0.085, 'metal', sides=8)

    rbox(part, (8.60, 2.05, 0.80), (1.80, 1.20, 1.60), 'wall', radius=0.04)
    rbox(part, (8.60, 2.05, 1.62), (1.60, 1.00, 0.06), 'metal')

    ground_anchors = [
        (9.20, 2.05, 1.65),
        (8.80, 2.05, 1.65),
        (8.40, 2.05, 1.65),
        (8.00, 2.05, 1.65),
    ]

    for i, g_pt in enumerate(ground_anchors):
        zh = cable_heights[i]
        frac = (zh - 2.20) / 24.80
        cx = 3.80 + (zh - 2.20) * tan_tilt
        wx = 1.90 - 0.95 * frac
        px = cx + wx * 0.5 + 0.05
        p_pt = (px, 2.05, zh)

        g_vec = Vector(g_pt)
        p_vec = Vector(p_pt)
        dir_v = (p_vec - g_vec).normalized()

        g_sleeve = g_vec + dir_v * 0.35
        p_sleeve = p_vec - dir_v * 0.35

        cyl(part, g_vec, g_sleeve, 0.090, 'metal', sides=8)
        cyl(part, g_sleeve, p_sleeve, 0.048, 'strip', sides=8)
        cyl(part, p_sleeve, p_vec, 0.090, 'metal', sides=8)

        bolt(part, (g_pt[0] - 0.12, 2.05, 1.65), (0.0, 0.0, 1.0), 0.015, 0.03)
        bolt(part, (g_pt[0] + 0.12, 2.05, 1.65), (0.0, 0.0, 1.0), 0.015, 0.03)

    return part


def build_ramp():
    part = HeroPart('ramp_a')

    slope_prism(part, -8.00, 7.96, 3.38, 3.45, 0.0, 0.0, 0.0, 1.190, 'wall')
    slope_prism(part, -8.00, 7.96, -3.45, -3.38, 0.0, 0.0, 0.0, 1.190, 'wall')

    slope_prism(part, -7.99, 7.92, -2.00, 2.00, 0.0, 1.160, 0.016, 1.195, 'body')

    for sx in (-5.0, -1.67, 1.67, 5.0):
        t = (sx + 8.0) / 16.0
        zr = t * 1.200
        rbox(part, (sx, 0.0, zr + 0.012), (1.80, 0.14, 0.008), 'wall')

    obox(part, (-7.95, -1.90, 0.014), (7.90, -1.90, 1.205), 0.10, 0.008, 'wall')
    obox(part, (-7.95, 1.90, 0.014), (7.90, 1.90, 1.205), 0.10, 0.008, 'wall')

    slope_prism(part, -7.97, 7.94, 1.95, 2.15, 0.0, 1.185, 0.150, 1.340, 'wall')
    slope_prism(part, -7.97, 7.94, -2.15, -1.95, 0.0, 1.185, 0.150, 1.340, 'wall')

    slope_prism(part, -7.95, 7.93, 2.15, 3.38, 0.0, 1.180, 0.140, 1.335, 'wall')
    slope_prism(part, -7.93, 7.93, 2.17, 3.36, 0.138, 1.335, 0.150, 1.350, 'floor')

    slope_prism(part, -7.95, 7.93, -3.38, -2.15, 0.0, 1.180, 0.140, 1.335, 'wall')
    slope_prism(part, -7.93, 7.93, -3.36, -2.17, 0.138, 1.335, 0.150, 1.350, 'floor')

    for side_y in (-3.40, 3.40):
        obox(part, (-8.0, side_y, 1.175), (8.0, side_y, 2.375), 0.08, 0.05, 'metal')
        obox(part, (-7.92, side_y, 1.140), (7.92, side_y, 2.340), 0.03, 0.012, 'strip')
        for px in (-7.0, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0, 7.0):
            t = (px + 8.0) / 16.0
            zw = 0.150 + t * 1.200
            rbox(part, (px, side_y, zw + 0.525), (0.06, 0.06, 1.05), 'metal')
        for h_frac in (0.27, 0.53, 0.79):
            z0 = 0.150 + h_frac * 1.05
            z1 = 1.350 + h_frac * 1.05
            cyl(part, (-7.92, side_y, z0), (7.92, side_y, z1), 0.015, 'metal', sides=8)

    rbox(part, (7.97, 0.0, 1.192), (0.04, 6.76, 0.024), 'metal')

    return part
