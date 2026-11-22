import math
import bmesh
from mathutils import Matrix, Vector
from hero_kit import HeroPart, rounded_rect


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


def anchor_bolts(part, cx, cy, z_top, spread_x, spread_y, row='metal'):
    sx_list = (0,) if spread_x == 0 else (-1, 1)
    sy_list = (0,) if spread_y == 0 else (-1, 1)
    for sx in sx_list:
        for sy in sy_list:
            bx = cx + sx * spread_x
            by = cy + sy * spread_y
            part.revolve(
                (bx, by, z_top - 0.005),
                'z',
                [(0.012, 0.0, row), (0.012, 0.020, row)],
                segments=6,
                smooth=False,
            )


def base_flange(part, cx, cy, width, depth, height=0.03, z_base=0.0, row='metal'):
    part.rounded_box((cx, cy, z_base + height * 0.5), (width, depth, height), row, radius=0.006, segments=1)
    anchor_bolts(part, cx, cy, z_base + height, width * 0.36, depth * 0.36, row)


def build_shelter():
    shelter = HeroPart('shelter_a')
    for px in (-1.15, 1.15):
        base_flange(shelter, px, 0.35, 0.22, 0.22, 0.03, 0.0, 'metal')
        shelter.rounded_box((px, 0.35, 1.16), (0.10, 0.10, 2.30), 'metal', radius=0.01, segments=1)
        shelter.rounded_box((px, 0.35, 1.25), (0.12, 0.12, 0.06), 'body', radius=0.008, segments=1)
        shelter.rounded_box((px, 0.35, 2.22), (0.12, 0.12, 0.06), 'body', radius=0.008, segments=1)

    for rz in (0.35, 1.25, 2.15):
        shelter.rounded_box((0, 0.35, rz), (2.36, 0.044, 0.044), 'metal', radius=0.005, segments=1)

    shelter.rounded_box((0, 0.35, 1.25), (2.16, 0.014, 1.62), 'soft', radius=0.004, segments=1)
    shelter.rounded_box((-1.45, 0.35, 1.25), (0.54, 0.014, 1.62), 'soft', radius=0.004, segments=1)
    shelter.rounded_box((1.45, 0.35, 1.25), (0.54, 0.014, 1.62), 'soft', radius=0.004, segments=1)

    for px in (-1.15, 1.15):
        sign = 1 if px < 0 else -1
        for cz in (0.75, 1.75):
            box(shelter, (px + 0.05 * sign, 0.35, cz), (0.08, 0.03, 0.03), 'metal')
        shelter.tube([(px, 0.42, 2.26), (px, -0.25, 2.36), (px, -0.90, 2.44)], 0.035, 'metal', sides=6)

    shelter.rounded_box((0, -0.92, 2.45), (3.60, 0.07, 0.09), 'body', radius=0.008, segments=1)
    shelter.rounded_box((0, -0.96, 2.45), (3.50, 0.012, 0.04), 'trim', radius=0.003, segments=1)
    shelter.rounded_box((0, 0.44, 2.27), (3.60, 0.07, 0.07), 'body', radius=0.008, segments=1)
    shelter.rounded_box((0, -0.24, 2.47), (3.56, 1.38, 0.014), 'soft', radius=0.004, segments=1)
    shelter.rounded_box((0, -0.40, 2.37), (2.80, 0.12, 0.012), 'strip', radius=0.003, segments=1)

    for bx in (-0.75, 0.75):
        shelter.rounded_box((bx, 0.18, 0.43), (0.05, 0.42, 0.07), 'metal', radius=0.006, segments=1)
        shelter.tube([(bx, 0.35, 0.22), (bx, 0.15, 0.42)], 0.018, 'metal', sides=4)

    shelter.rounded_box((0, 0.05, 0.465), (1.90, 0.08, 0.026), 'top', radius=0.006, segments=1)
    shelter.rounded_box((0, 0.16, 0.465), (1.90, 0.08, 0.026), 'top', radius=0.006, segments=1)
    shelter.rounded_box((0, 0.27, 0.465), (1.90, 0.08, 0.026), 'top', radius=0.006, segments=1)

    shelter.rounded_box((1.45, 0.05, 1.35), (0.12, 0.52, 1.20), 'body', radius=0.012, segments=1)
    shelter.rounded_box((1.45, -0.215, 1.35), (0.13, 0.02, 1.22), 'metal', radius=0.006, segments=1)
    box(shelter, (1.45, -0.226, 1.35), (0.10, 0.008, 1.10), 'screen')
    shelter.rounded_box((1.45, -0.226, 1.95), (0.08, 0.016, 0.12), 'accent', radius=0.004, segments=1)

    return shelter


def build_bench():
    bench = HeroPart('bench_a')
    for sx in (-0.78, 0.0, 0.78):
        bench.rounded_box((sx, 0.0, 0.018), (0.060, 0.46, 0.036), 'metal', radius=0.006, segments=1)
        anchor_bolts(bench, sx, 0.0, 0.036, 0.0, 0.18, 'metal')
        bench.rounded_box((sx, 0.0, 0.408), (0.048, 0.38, 0.060), 'metal', radius=0.006, segments=1)
        bench.rounded_box((sx, 0.0, 0.20), (0.038, 0.08, 0.35), 'metal', radius=0.006, segments=1)
        bench.tube([(sx, 0.14, 0.39), (sx, 0.22, 0.74)], 0.020, 'metal', sides=4)
        if sx != 0.0:
            bench.tube([(sx, -0.16, 0.42), (sx, -0.16, 0.58), (sx, 0.16, 0.58), (sx, 0.18, 0.44)], 0.018, 'metal', sides=4)
            bench.rounded_box((sx, 0.0, 0.60), (0.055, 0.32, 0.024), 'metal', radius=0.005, segments=1)

    bench.tube([(-0.82, -0.09, 0.40), (0.82, -0.09, 0.40)], 0.012, 'metal', sides=6)
    bench.tube([(-0.82, 0.09, 0.40), (0.82, 0.09, 0.40)], 0.012, 'metal', sides=6)

    for sy in (-0.14, -0.05, 0.04, 0.13):
        bench.rounded_box((0, sy, 0.435), (1.84, 0.070, 0.024), 'top', radius=0.006, segments=1)

    for by, bz in ((0.16, 0.53), (0.19, 0.63), (0.22, 0.73)):
        bench.rounded_box((0, by, bz), (1.84, 0.070, 0.024), 'top', radius=0.006, segments=1)

    return bench


def build_railing():
    railing = HeroPart('railing_a')
    for px in (-0.96, 0.96):
        base_flange(railing, px, 0, 0.12, 0.12, 0.025, 0.0, 'metal')
        railing.rounded_box((px, 0, 0.465), (0.055, 0.055, 0.90), 'metal', radius=0.006, segments=1)
        railing.rounded_box((px, 0, 0.950), (0.075, 0.075, 0.035), 'metal', radius=0.005, segments=1)

    base_flange(railing, 0, 0, 0.10, 0.10, 0.02, 0.0, 'metal')
    railing.rounded_box((0, 0, 0.45), (0.045, 0.045, 0.88), 'metal', radius=0.005, segments=1)

    railing.rounded_box((0, 0, 0.915), (2.00, 0.065, 0.04), 'metal', radius=0.008, segments=1)
    railing.rounded_box((0, 0, 0.14), (1.88, 0.035, 0.035), 'metal', radius=0.004, segments=1)
    railing.rounded_box((0, 0, 0.52), (1.88, 0.035, 0.035), 'metal', radius=0.004, segments=1)

    for step in range(1, 8):
        x_left = -0.96 + step * 0.12
        x_right = 0.0 + step * 0.12
        for x in (x_left, x_right):
            box(railing, (x, 0, 0.33), (0.016, 0.016, 0.37), 'metal')
            box(railing, (x, 0, 0.71), (0.016, 0.016, 0.37), 'metal')

    for mx in (-0.48, 0.48):
        railing.rounded_box((mx, 0, 0.52), (0.08, 0.045, 0.08), 'trim', radius=0.004, segments=1)

    return railing


def build_bollard():
    bollard = HeroPart('bollard_a')
    bollard.revolve((0, 0, 0), 'z', [(0.13, 0.0, 'metal'), (0.13, 0.025, 'metal'), (0.11, 0.035, 'metal'), (0.09, 0.045, 'metal')], segments=12, smooth=True)
    anchor_bolts(bollard, 0, 0, 0.025, 0.075, 0.075, 'metal')
    bollard.revolve((0, 0, 0), 'z', [
        (0.082, 0.035, 'metal'),
        (0.082, 0.25, 'metal'),
        (0.078, 0.255, 'metal'),
        (0.078, 0.265, 'metal'),
        (0.082, 0.27, 'metal'),
        (0.082, 0.68, 'metal'),
        (0.078, 0.685, 'strip'),
        (0.078, 0.765, 'strip'),
        (0.082, 0.77, 'metal'),
    ], segments=12, smooth=True)
    bollard.revolve((0, 0, 0), 'z', [
        (0.082, 0.765, 'metal'),
        (0.086, 0.79, 'metal'),
        (0.075, 0.84, 'metal'),
        (0.04, 0.875, 'metal'),
        (0.005, 0.885, 'metal'),
    ], segments=12, smooth=True)
    bollard.rounded_box((0, 0, 0.88), (0.03, 0.03, 0.015), 'soft', radius=0.003, segments=1)
    return bollard


def build_binpair():
    binpair = HeroPart('binpair_a')
    base_flange(binpair, 0, 0, 0.34, 0.26, 0.025, 0.0, 'metal')
    binpair.rounded_box((0, 0, 0.42), (0.08, 0.08, 0.80), 'metal', radius=0.008, segments=1)
    binpair.rounded_box((0, 0, 0.52), (0.76, 0.06, 0.06), 'metal', radius=0.006, segments=1)

    for bx in (-0.24, 0.24):
        binpair.rounded_box((bx, 0, 0.48), (0.04, 0.28, 0.04), 'metal', radius=0.004, segments=1)
        binpair.rounded_box((bx, 0, 0.52), (0.34, 0.34, 0.58), 'body', radius=0.018, segments=1)
        box(binpair, (bx, -0.171, 0.52), (0.008, 0.004, 0.52), 'soft')
        box(binpair, (bx, -0.175, 0.74), (0.03, 0.012, 0.03), 'metal')
        sign = 1 if bx < 0 else -1
        box(binpair, (bx - 0.165 * sign, -0.174, 0.36), (0.018, 0.012, 0.04), 'metal')
        box(binpair, (bx - 0.165 * sign, -0.174, 0.68), (0.018, 0.012, 0.04), 'metal')
        binpair.rounded_box((bx, 0, 0.86), (0.36, 0.36, 0.12), 'metal', radius=0.012, segments=1)
        box(binpair, (bx, -0.181, 0.85), (0.24, 0.008, 0.07), 'soft')
        box(binpair, (bx, 0.181, 0.85), (0.24, 0.008, 0.07), 'soft')
        binpair.rounded_box((bx, 0, 0.925), (0.16, 0.16, 0.015), 'metal', radius=0.004, segments=1)
        box(binpair, (bx, 0, 0.934), (0.12, 0.12, 0.004), 'soft')

    box(binpair, (-0.24, -0.173, 0.60), (0.18, 0.006, 0.10), 'soft')
    box(binpair, (0.24, -0.173, 0.60), (0.18, 0.006, 0.10), 'trim')

    return binpair


def build_cabinet():
    cabinet = HeroPart('cabinet_a')
    cabinet.rounded_box((0, 0, 0.075), (0.78, 0.44, 0.15), 'top', radius=0.012, segments=1)
    box(cabinet, (0, 0, 0.155), (0.74, 0.40, 0.02), 'metal')

    cabinet.rounded_box((0, 0, 0.685), (0.80, 0.46, 1.04), 'body', radius=0.016, segments=1)

    cabinet.rounded_box((-0.195, -0.235, 0.685), (0.38, 0.016, 1.00), 'body', radius=0.006, segments=1)
    cabinet.rounded_box((0.195, -0.235, 0.685), (0.38, 0.016, 1.00), 'body', radius=0.006, segments=1)
    box(cabinet, (0.01, -0.245, 0.685), (0.025, 0.010, 1.00), 'metal')
    cabinet.rounded_box((0.035, -0.256, 0.685), (0.035, 0.025, 0.14), 'metal', radius=0.004, segments=1)

    for hz in (0.32, 1.05):
        box(cabinet, (-0.395, -0.238, hz), (0.018, 0.018, 0.05), 'metal')
        box(cabinet, (0.395, -0.238, hz), (0.018, 0.018, 0.05), 'metal')

    for vz in (0.36, 1.02):
        box(cabinet, (-0.195, -0.245, vz), (0.22, 0.006, 0.09), 'soft')
        box(cabinet, (0.195, -0.245, vz), (0.22, 0.006, 0.09), 'soft')
        box(cabinet, (-0.403, 0, vz), (0.006, 0.20, 0.09), 'soft')
        box(cabinet, (0.403, 0, vz), (0.006, 0.20, 0.09), 'soft')

    box(cabinet, (0.195, -0.245, 0.78), (0.10, 0.006, 0.09), 'trim')
    cabinet.rounded_box((0, 0.01, 1.225), (0.84, 0.50, 0.06), 'metal', radius=0.01, segments=1)
    box(cabinet, (-0.37, -0.21, 0.05), (0.025, 0.025, 0.03), 'metal')

    return cabinet


def build_hydrant():
    hydrant = HeroPart('hydrant_a')
    hydrant.revolve((0, 0, 0), 'z', [(0.15, 0.0, 'metal'), (0.15, 0.03, 'metal'), (0.11, 0.04, 'metal'), (0.09, 0.048, 'top')], segments=12, smooth=True)
    for i in range(6):
        a = i * math.pi / 3
        hydrant.revolve((0.13 * math.cos(a), 0.13 * math.sin(a), 0.025), 'z', [(0.011, 0, 'metal'), (0.011, 0.018, 'metal')], segments=6, smooth=False)

    hydrant.revolve((0, 0, 0), 'z', [(0.09, 0.045, 'top'), (0.09, 0.42, 'top'), (0.105, 0.44, 'top')], segments=12, smooth=True)
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        box(hydrant, (0.096 * math.cos(a), 0.096 * math.sin(a), 0.24), (0.018, 0.018, 0.32), 'top')

    hydrant.revolve((0, 0, 0), 'z', [(0.105, 0.44, 'top'), (0.115, 0.52, 'top'), (0.11, 0.62, 'top'), (0.08, 0.67, 'top'), (0.04, 0.69, 'metal'), (0.04, 0.71, 'metal')], segments=12, smooth=True)
    hydrant.revolve((0, 0, 0.71), 'z', [(0.024, 0, 'metal'), (0.024, 0.07, 'metal'), (0.005, 0.07, 'metal')], segments=5, smooth=False)

    hydrant.tube([(0, -0.06, 0.52), (0, -0.17, 0.52)], 0.065, 'top', sides=8)
    hydrant.tube([(0, -0.165, 0.52), (0, -0.20, 0.52)], 0.075, 'metal', sides=8)
    hydrant.tube([(0, -0.198, 0.52), (0, -0.22, 0.52)], 0.022, 'metal', sides=5)
    hydrant.tube([(0, -0.19, 0.48), (0, -0.15, 0.36), (0, -0.10, 0.44)], 0.008, 'metal', sides=4)

    for sx in (-1, 1):
        hydrant.tube([(sx * 0.06, 0, 0.46), (sx * 0.17, 0, 0.46)], 0.046, 'top', sides=8)
        hydrant.tube([(sx * 0.165, 0, 0.46), (sx * 0.195, 0, 0.46)], 0.055, 'metal', sides=8)
        box(hydrant, (sx * 0.195, 0, 0.46), (0.015, 0.13, 0.025), 'metal')
        hydrant.tube([(sx * 0.19, 0, 0.42), (sx * 0.14, 0, 0.35), (sx * 0.10, 0, 0.40)], 0.007, 'metal', sides=4)

    return hydrant


def build_manhole():
    manhole = HeroPart('manhole_a')
    manhole.rounded_box((0, 0, 0.017), (0.90, 0.90, 0.034), 'metal', radius=0.015, segments=1)
    for cx, cy in ((-0.38, -0.38), (0.38, -0.38), (-0.38, 0.38), (0.38, 0.38)):
        manhole.revolve((cx, cy, 0.02), 'z', [(0.014, 0.0, 'soft'), (0.014, 0.016, 'soft')], segments=8, smooth=False)
        manhole.revolve((cx, cy, 0.014), 'z', [(0.008, 0.0, 'metal'), (0.008, 0.024, 'metal')], segments=6, smooth=False)

    manhole.revolve((0, 0, 0.018), 'z', [(0.36, 0.0, 'body'), (0.36, 0.018, 'body'), (0.005, 0.018, 'body')], segments=14, smooth=True)

    points_outer = [Vector((0.28 * math.cos(i * 2 * math.pi / 16), 0.28 * math.sin(i * 2 * math.pi / 16), 0.034)) for i in range(16)]
    manhole.tube(points_outer, 0.006, 'metal', sides=6, closed=True)

    points_inner = [Vector((0.18 * math.cos(i * 2 * math.pi / 14), 0.18 * math.sin(i * 2 * math.pi / 14), 0.034)) for i in range(14)]
    manhole.tube(points_inner, 0.005, 'metal', sides=6, closed=True)

    for ix in range(-2, 3):
        for iy in range(-2, 3):
            if ix == 0 and iy == 0:
                continue
            if ix * ix + iy * iy <= 5:
                box(manhole, (ix * 0.065, iy * 0.065, 0.035), (0.028, 0.028, 0.008), 'metal')

    box(manhole, (-0.23, 0, 0.028), (0.020, 0.05, 0.006), 'soft')
    box(manhole, (0.23, 0, 0.028), (0.020, 0.05, 0.006), 'soft')
    manhole.rounded_box((0, 0, 0.035), (0.08, 0.08, 0.006), 'top', radius=0.004, segments=1)

    return manhole


def build_adpillar():
    adpillar = HeroPart('adpillar_a')
    adpillar.rounded_box((0, 0, 0.06), (1.20, 0.34, 0.12), 'metal', radius=0.012, segments=1)
    adpillar.rounded_box((0, 0, 0.13), (1.16, 0.30, 0.02), 'metal', radius=0.008, segments=1)
    anchor_bolts(adpillar, 0, 0, 0.12, 0.52, 0.11, 'metal')

    adpillar.rounded_box((-0.53, 0, 1.45), (0.09, 0.28, 2.62), 'metal', radius=0.01, segments=1)
    adpillar.rounded_box((0.53, 0, 1.45), (0.09, 0.28, 2.62), 'metal', radius=0.01, segments=1)
    box(adpillar, (-0.575, 0, 1.45), (0.008, 0.12, 2.50), 'body')
    box(adpillar, (0.575, 0, 1.45), (0.008, 0.12, 2.50), 'body')

    adpillar.rounded_box((0, 0, 1.45), (0.97, 0.26, 2.58), 'body', radius=0.012, segments=1)

    for vz in (0.45, 2.45):
        box(adpillar, (-0.480, 0, vz), (0.016, 0.16, 0.08), 'soft')
        box(adpillar, (0.480, 0, vz), (0.016, 0.16, 0.08), 'soft')

    adpillar.image_rect([
        (-0.44, -0.134, 0.37),
        (0.44, -0.134, 0.37),
        (0.44, -0.134, 2.53),
        (-0.44, -0.134, 2.53),
    ], 'decal', (0.0, 0.0, 1.0, 1.0))

    adpillar.image_rect([
        (0.44, 0.134, 0.37),
        (-0.44, 0.134, 0.37),
        (-0.44, 0.134, 2.53),
        (0.44, 0.134, 2.53),
    ], 'decal', (0.0, 0.0, 1.0, 1.0))

    box(adpillar, (0, -0.131, 0.364), (0.86, 0.006, 0.012), 'screen')
    box(adpillar, (0, -0.131, 2.536), (0.86, 0.006, 0.012), 'screen')
    box(adpillar, (-0.446, -0.133, 1.45), (0.012, 0.004, 2.16), 'screen')
    box(adpillar, (0.446, -0.133, 1.45), (0.012, 0.004, 2.16), 'screen')

    box(adpillar, (0, 0.131, 0.364), (0.86, 0.006, 0.012), 'screen')
    box(adpillar, (0, 0.131, 2.536), (0.86, 0.006, 0.012), 'screen')
    box(adpillar, (-0.446, 0.133, 1.45), (0.012, 0.004, 2.16), 'screen')
    box(adpillar, (0.446, 0.133, 1.45), (0.012, 0.004, 2.16), 'screen')

    box(adpillar, (0, -0.138, 1.45), (0.92, 0.010, 2.20), 'metal')
    box(adpillar, (0, 0.138, 1.45), (0.92, 0.010, 2.20), 'metal')

    adpillar.rounded_box((0, 0, 2.82), (1.24, 0.36, 0.12), 'metal', radius=0.01, segments=1)
    box(adpillar, (0, -0.15, 2.755), (0.80, 0.03, 0.010), 'strip')
    box(adpillar, (0, 0.15, 2.755), (0.80, 0.03, 0.010), 'strip')

    return adpillar
